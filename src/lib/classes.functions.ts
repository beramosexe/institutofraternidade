import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLASS_STATUS = ["planned", "open", "ongoing", "closed", "cancelled"] as const;

async function assertCanManageClasses(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("can_manage_classes", { _user_id: context.userId });
  if (!data) throw new Error("Sem permissão para gerenciar turmas.");
}

async function logMemberEvent(
  context: { supabase: any; userId: string },
  userId: string,
  kind: string,
  title: string,
  details?: Record<string, unknown>,
) {
  await context.supabase.from("member_events").insert({
    user_id: userId,
    kind,
    title,
    details: (details ?? null) as never,
    actor_id: context.userId,
  });
}

export const listFormationLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("formation_levels")
      .select("id, name, sort_order, is_active")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createFormationLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; sort_order?: number }) =>
    z.object({ name: z.string().min(2).max(60), sort_order: z.number().int().min(0).max(999).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageClasses(context);
    const { data: row, error } = await context.supabase
      .from("formation_levels")
      .insert({ name: data.name, sort_order: data.sort_order ?? 99 })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classes")
      .select("id, name, period, status, opened_at, closed_at, notes, level_id, formation_levels(id, name), class_members(id, status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      ...c,
      level_name: c.formation_levels?.name ?? null,
      member_count: (c.class_members ?? []).filter((m: any) => m.status === "active").length,
    }));
  });

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string; level_id?: string | null; period?: string; status?: string; notes?: string;
  }) =>
    z.object({
      name: z.string().min(2).max(120),
      level_id: z.string().uuid().nullable().optional(),
      period: z.string().max(40).optional(),
      status: z.enum(CLASS_STATUS).optional(),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageClasses(context);
    const { data: row, error } = await context.supabase
      .from("classes")
      .insert({
        name: data.name,
        level_id: data.level_id ?? null,
        period: data.period ?? null,
        status: (data.status ?? "planned") as never,
        notes: data.notes ?? null,
        created_by: context.userId,
        opened_at: data.status === "open" || data.status === "ongoing" ? new Date().toISOString().slice(0, 10) : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "classes", entity_id: row.id, action: "create",
      diff: { name: data.name } as never,
    });
    return row;
  });

export const updateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string; name?: string; level_id?: string | null; period?: string | null;
    status?: string; notes?: string | null;
  }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(120).optional(),
      level_id: z.string().uuid().nullable().optional(),
      period: z.string().max(40).nullable().optional(),
      status: z.enum(CLASS_STATUS).optional(),
      notes: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageClasses(context);
    const { id, ...patch } = data;
    const extra: Record<string, unknown> = {};
    if (patch.status === "closed") extra.closed_at = new Date().toISOString().slice(0, 10);
    if (patch.status === "open" || patch.status === "ongoing") extra.closed_at = null;
    const { error } = await context.supabase
      .from("classes")
      .update({ ...patch, ...extra } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "classes", entity_id: id, action: "update",
      diff: patch as never,
    });
    return { ok: true };
  });

export const getClassDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [{ data: cls }, { data: members }] = await Promise.all([
      context.supabase
        .from("classes")
        .select("id, name, period, status, opened_at, closed_at, notes, level_id, formation_levels(id, name)")
        .eq("id", data.id)
        .maybeSingle(),
      context.supabase
        .from("class_members")
        .select("id, user_id, is_primary, purpose, joined_at, left_at, status, notes, profiles:user_id(full_name)")
        .eq("class_id", data.id)
        .order("joined_at", { ascending: false }),
    ]);
    if (!cls) throw new Error("Turma não encontrada.");
    return { cls, members: members ?? [] };
  });

export const addClassMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { class_id: string; user_id: string; purpose?: string; is_primary?: boolean }) =>
    z.object({
      class_id: z.string().uuid(),
      user_id: z.string().uuid(),
      purpose: z.string().max(200).optional(),
      is_primary: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageClasses(context);
    const { data: cls } = await context.supabase.from("classes").select("name").eq("id", data.class_id).maybeSingle();
    const { error } = await context.supabase.from("class_members").insert({
      class_id: data.class_id,
      user_id: data.user_id,
      purpose: data.purpose ?? null,
      is_primary: data.is_primary ?? true,
      changed_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await logMemberEvent(context, data.user_id, "class.joined", `Vinculado à turma ${cls?.name ?? ""}`.trim(), {
      class_id: data.class_id, purpose: data.purpose ?? null,
    });
    return { ok: true };
  });

export const endClassMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: "ended" | "removed"; notes?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["ended", "removed"]).optional(),
      notes: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageClasses(context);
    const { data: row } = await context.supabase
      .from("class_members")
      .select("user_id, class_id, classes(name)")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("class_members")
      .update({
        status: (data.status ?? "ended") as never,
        left_at: new Date().toISOString().slice(0, 10),
        notes: data.notes ?? null,
        changed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row) {
      await logMemberEvent(
        context,
        row.user_id,
        "class.left",
        `Vínculo encerrado na turma ${row.classes?.name ?? ""}`.trim(),
        { class_id: row.class_id, status: data.status ?? "ended" },
      );
    }
    return { ok: true };
  });
