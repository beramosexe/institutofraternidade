import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dados do check-in: trabalho + lista de "frequentes" + presenças do dia. */
export const getCheckinData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { work_id: string; occurrence_date: string }) =>
    z.object({
      work_id: z.string().uuid(),
      occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RLS check: usuário precisa enxergar este trabalho (admin / work.manage / responsável)
    const { data: workAccess, error: waErr } = await supabase
      .from("works")
      .select("id")
      .eq("id", data.work_id)
      .maybeSingle();
    if (waErr) throw new Error(waErr.message);
    if (!workAccess) throw new Error("Trabalho não encontrado ou sem acesso.");

    const [
      { data: work },
      { data: participants },
      { data: attendances },
      { data: history },
    ] = await Promise.all([
      supabaseAdmin
        .from("works")
        .select("id, name, starts_at, location, modality, recurrence, recurrence_weekday, recurrence_time")
        .eq("id", data.work_id)
        .maybeSingle(),
      supabaseAdmin
        .from("work_participants")
        .select("user_id")
        .eq("work_id", data.work_id),
      supabaseAdmin
        .from("attendance")
        .select("id, user_id, guest_name, guest_email, guest_phone, checked_in_at")
        .eq("work_id", data.work_id)
        .eq("occurrence_date", data.occurrence_date),
      supabaseAdmin
        .from("attendance")
        .select("user_id")
        .eq("work_id", data.work_id)
        .not("user_id", "is", null),
    ]);

    if (!work) throw new Error("Trabalho não encontrado.");

    // Auto-promove usuários com >=3 presenças
    const counts = new Map<string, number>();
    for (const r of history ?? []) {
      if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
    }
    const recurrentIds = [...counts.entries()].filter(([, n]) => n >= 3).map(([id]) => id);

    const participantIds = (participants ?? []).map((p) => p.user_id);
    const allRegularIds = Array.from(new Set([...participantIds, ...recurrentIds]));
    const attendanceUserIds = (attendances ?? []).map((a) => a.user_id).filter((x): x is string => !!x);
    const allProfileIds = Array.from(new Set([...allRegularIds, ...attendanceUserIds]));

    let profileMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();
    if (allProfileIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", allProfileIds);
      profileMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }

    const participantSet = new Set(participantIds);
    const regulars = allRegularIds.map((id) => {
      const p = profileMap.get(id);
      return {
        user_id: id,
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        kind: participantSet.has(id) ? ("participant" as const) : ("recurrent" as const),
      };
    });

    return {
      work,
      regulars,
      attendances: (attendances ?? []).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        guest_name: a.guest_name,
        guest_email: a.guest_email,
        guest_phone: a.guest_phone,
        checked_in_at: a.checked_in_at,
        full_name: (a.user_id ? profileMap.get(a.user_id)?.full_name : null) ?? a.guest_name ?? null,
        avatar_url: a.user_id ? profileMap.get(a.user_id)?.avatar_url ?? null : null,
      })),
    };
  });

export const searchProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) =>
    z.object({ q: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    void context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .ilike("full_name", `${data.q}%`)
      .limit(8);
    return rows ?? [];
  });

export const markPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    work_id: string;
    occurrence_date: string;
    user_id?: string | null;
    guest_name?: string | null;
    guest_email?: string | null;
    guest_phone?: string | null;
  }) =>
    z.object({
      work_id: z.string().uuid(),
      occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      user_id: z.string().uuid().nullable().optional(),
      guest_name: z.string().trim().max(120).nullable().optional(),
      guest_email: z.string().trim().email().max(255).nullable().optional(),
      guest_phone: z.string().trim().max(40).nullable().optional(),
    }).refine(
      (v) => !!v.user_id || !!v.guest_email || !!v.guest_phone,
      { message: "Informe usuário, e-mail ou telefone." },
    ).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const insertable = {
      work_id: data.work_id,
      occurrence_date: data.occurrence_date,
      user_id: data.user_id ?? null,
      guest_name: data.user_id ? null : data.guest_name ?? null,
      guest_email: data.user_id ? null : data.guest_email ?? null,
      guest_phone: data.user_id ? null : data.guest_phone ?? null,
      created_by: userId,
      method: "manual",
    };
    const { data: row, error } = await supabase
      .from("attendance")
      .insert(insertable)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Esta pessoa já está marcada como presente.");
      throw new Error(error.message);
    }
    if (!data.user_id && (data.guest_email || data.guest_phone)) {
      await supabase.from("pending_invites").insert({
        work_id: data.work_id,
        email: data.guest_email ?? null,
        phone: data.guest_phone ?? null,
        full_name: data.guest_name ?? null,
        created_by: userId,
      });
    }
    return row;
  });

export const unmarkPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("attendance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
