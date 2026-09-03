import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  status: z.enum(["draft", "published", "completed", "archived"]),
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
    const { error } = await context.supabase.from("works").update(row).eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncLinks(context.supabase as never, data.id, data.patch);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: data.id, action: "update",
      diff: row as never,
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
