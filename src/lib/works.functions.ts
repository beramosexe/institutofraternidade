import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nextWorkOccurrence, offsetMilliseconds, renderWorkCommunication } from "@/lib/communication-scheduling";

const workInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  status: z.enum(["draft", "published", "postponed", "cancelled", "completed", "archived"]),
  visibility: z.enum(["public", "internal"]),
  modality: z.enum(["presencial", "online", "hibrido", "externo"]).nullable().optional(),
  recurrence: z.enum(["one_off", "weekly"]).default("one_off"),
  recurrence_weekday: z.number().int().min(0).max(6).nullable().optional(),
  recurrence_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  responsible_ids: z.array(z.string().uuid()).max(20).optional(),
  favorite_entity_ids: z.array(z.string().uuid()).max(50).optional(),
  participant_ids: z.array(z.string().uuid()).max(200).optional(),
});

type WorkInput = z.infer<typeof workInput>;

async function rebuildFutureCommunications(workId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: work }, { data: rules }, { data: future }] = await Promise.all([
    supabaseAdmin.from("works").select("id, name, starts_at, recurrence, recurrence_weekday, recurrence_time, location, status").eq("id", workId).single(),
    supabaseAdmin.from("work_communication_rules").select("*").eq("work_id", workId).eq("is_active", true),
    supabaseAdmin.from("social_media_posts").select("id").eq("work_id", workId).in("status", ["draft", "pending_approval", "scheduled", "failed"]).gte("scheduled_for", new Date().toISOString()),
  ]);
  if (!work) return;
  if ((future ?? []).length > 0) {
    await supabaseAdmin.from("social_media_posts").update({ status: "cancelled", cancellation_reason: "Horário do trabalho atualizado" }).in("id", (future ?? []).map((item) => item.id));
  }
  if (["cancelled", "completed", "archived"].includes(work.status)) return;
  const occurrence = nextWorkOccurrence(work);
  for (const rule of rules ?? []) {
    const milliseconds = offsetMilliseconds(rule.offset_value, rule.offset_unit as "minutes" | "hours" | "days" | "weeks");
    const automatic = rule.approval_mode === "automatic";
    await supabaseAdmin.from("social_media_posts").insert({
      title: `${rule.name} · ${work.name}`,
      content_text: renderWorkCommunication(rule.content_text, work, occurrence),
      media_url: rule.media_url,
      channels: rule.channels,
      scheduled_for: new Date(occurrence.getTime() - milliseconds).toISOString(),
      status: automatic ? "scheduled" : "draft",
      approval_mode: rule.approval_mode,
      approved_at: automatic ? new Date().toISOString() : null,
      approved_by: automatic ? userId : null,
      source: "work_reminder",
      communication_kind: "work_notice",
      schedule_type: "automatic",
      work_id: work.id,
      rule_id: rule.id,
      occurrence_at: occurrence.toISOString(),
      reminder_minutes: Math.round(milliseconds / 60_000),
      created_by: userId,
    });
  }
}

export const listWorks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("works")
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWorkDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [{ data: work, error }, { data: resps }, { data: favs }, { data: parts }] = await Promise.all([
      context.supabase.from("works").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("work_responsibles").select("user_id").eq("work_id", data.id),
      context.supabase.from("work_entity_favorites").select("entity_id").eq("work_id", data.id),
      context.supabase.from("work_participants").select("user_id").eq("work_id", data.id),
    ]);
    if (error) throw new Error(error.message);
    if (!work) throw new Error("Trabalho não encontrado.");
    return {
      work,
      responsible_ids: (resps ?? []).map((r) => r.user_id),
      favorite_entity_ids: (favs ?? []).map((f) => f.entity_id),
      participant_ids: (parts ?? []).map((p) => p.user_id),
    };
  });

async function syncLinks(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workId: string,
  patch: WorkInput,
) {
  if (patch.responsible_ids) {
    await supabase.from("work_responsibles").delete().eq("work_id", workId);
    if (patch.responsible_ids.length > 0) {
      await supabase.from("work_responsibles").insert(
        patch.responsible_ids.map((user_id) => ({ work_id: workId, user_id })),
      );
    }
  }
  if (patch.favorite_entity_ids) {
    await supabase.from("work_entity_favorites").delete().eq("work_id", workId);
    if (patch.favorite_entity_ids.length > 0) {
      await supabase.from("work_entity_favorites").insert(
        patch.favorite_entity_ids.map((entity_id) => ({ work_id: workId, entity_id })),
      );
    }
  }
  if (patch.participant_ids) {
    await supabase.from("work_participants").delete().eq("work_id", workId);
    if (patch.participant_ids.length > 0) {
      await supabase.from("work_participants").insert(
        patch.participant_ids.map((user_id) => ({ work_id: workId, user_id })),
      );
    }
  }
}

export const createWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: WorkInput) => workInput.parse(d))
  .handler(async ({ context, data }) => {
    const { responsible_ids, favorite_entity_ids, participant_ids, ...row } = data;
    const { data: created, error } = await context.supabase
      .from("works")
      .insert({ ...row, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await syncLinks(context.supabase as never, created.id, data);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: created.id, action: "create",
      diff: row as never,
    });
    return created;
  });

export const updateWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: WorkInput }) =>
    z.object({ id: z.string().uuid(), patch: workInput }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { responsible_ids, favorite_entity_ids, participant_ids, ...row } = data.patch;
    const { data: previous } = await context.supabase
      .from("works")
      .select("starts_at, recurrence, recurrence_weekday, recurrence_time")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("works").update(row).eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncLinks(context.supabase as never, data.id, data.patch);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: data.id, action: "update",
      diff: row as never,
    });
    const scheduleChanged = previous && (
      previous.starts_at !== row.starts_at || previous.recurrence !== row.recurrence
      || previous.recurrence_weekday !== row.recurrence_weekday || previous.recurrence_time !== row.recurrence_time
    );
    if (scheduleChanged) await rebuildFutureCommunications(data.id, context.userId);
    return { ok: true };
  });

const workLifecycleSchema = z.object({
  workId: z.string().uuid(),
  action: z.enum(["postponed", "cancelled"]),
  scope: z.enum(["next", "series"]),
  occurrenceAt: z.string().datetime(),
  newStartsAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  channels: z.array(z.enum(["instagram", "facebook", "whatsapp", "email", "telegram", "youtube"])).min(1),
});

export const changeWorkSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof workLifecycleSchema>) => workLifecycleSchema.parse(d))
  .handler(async ({ context, data }) => {
    const [{ data: admin }, { data: allowed }] = await Promise.all([
      context.supabase.rpc("is_admin", { _user_id: context.userId }),
      context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "work.manage" }),
    ]);
    if (!admin && !allowed) throw new Error("Você não tem permissão para alterar trabalhos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: work } = await supabaseAdmin.from("works").select("*").eq("id", data.workId).single();
    if (!work) throw new Error("Trabalho não encontrado.");
    if (data.action === "postponed" && !data.newStartsAt) throw new Error("Informe a nova data e hora.");

    const postponedTo = data.action === "postponed" ? data.newStartsAt : null;
    if (data.scope === "series") {
      const postponedDate = postponedTo ? new Date(postponedTo) : null;
      const update = postponedDate
        ? {
            status: "published" as const,
            starts_at: postponedDate.toISOString(),
            recurrence_weekday: work.recurrence === "weekly" ? postponedDate.getDay() : work.recurrence_weekday,
            recurrence_time: work.recurrence === "weekly" ? postponedDate.toTimeString().slice(0, 8) : work.recurrence_time,
          }
        : { status: "cancelled" as const };
      const { error } = await supabaseAdmin.from("works").update(update).eq("id", data.workId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("work_occurrence_exceptions").upsert({
        work_id: data.workId,
        original_starts_at: data.occurrenceAt,
        action: data.action,
        new_starts_at: data.action === "postponed" ? data.newStartsAt : null,
        reason: data.reason || null,
        created_by: context.userId,
      }, { onConflict: "work_id,original_starts_at" });
      if (error) throw new Error(error.message);
    }

    const { data: future } = await supabaseAdmin
      .from("social_media_posts")
      .select("id")
      .eq("work_id", data.workId)
      .in("status", ["draft", "pending_approval", "scheduled", "failed"])
      .gte("scheduled_for", new Date().toISOString());
    if ((future ?? []).length > 0) {
      await supabaseAdmin.from("social_media_posts").update({
        status: "cancelled",
        cancellation_reason: data.action === "cancelled" ? "Trabalho cancelado" : "Trabalho adiado",
      }).in("id", (future ?? []).map((item) => item.id));
    }

    const occurrence = new Date(data.newStartsAt ?? data.occurrenceAt);
    const reasonText = data.reason ? ` Motivo: ${data.reason}` : "";
    const content = data.action === "cancelled"
      ? `O trabalho ${work.name}, previsto para ${new Date(data.occurrenceAt).toLocaleString("pt-BR")}, foi cancelado.${reasonText}`
      : `O trabalho ${work.name} foi adiado para ${occurrence.toLocaleString("pt-BR")}.${reasonText}`;
    const { error: communicationError } = await supabaseAdmin.from("social_media_posts").insert({
      title: `${data.action === "cancelled" ? "Cancelamento" : "Adiamento"} · ${work.name}`,
      content_text: content,
      channels: data.channels,
      scheduled_for: new Date().toISOString(),
      status: "draft",
      source: data.action === "cancelled" ? "work_cancelled" : "work_postponed",
      communication_kind: data.action === "cancelled" ? "work_cancelled" : "work_postponed",
      schedule_type: "automatic",
      work_id: data.workId,
      occurrence_at: occurrence.toISOString(),
      approval_mode: "manual",
      created_by: context.userId,
    });
    if (communicationError) throw new Error(communicationError.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      entity: "works",
      entity_id: data.workId,
      action: data.action,
      diff: data,
    });
    return { ok: true };
  });

export const deleteWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("works").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: data.id, action: "delete",
    });
    return { ok: true };
  });

/** Busca perfis para autocompletar campos de seleção de usuários (responsáveis, participantes). */
export const searchUsers = createServerFn({ method: "POST" })
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
      .limit(10);
    return rows ?? [];
  });

/** Lookup em lote para hidratar IDs já selecionados em nomes. */
export const getProfilesByIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    void context;
    if (data.ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", data.ids);
    return rows ?? [];
  });
