import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEntities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("channeling_entities")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const entityInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const createEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof entityInput>) => entityInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("channeling_entities")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: z.infer<typeof entityInput> }) =>
    z.object({ id: z.string().uuid(), patch: entityInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("channeling_entities")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("channeling_entities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Entidades disponíveis para um upload: ativas, com as favoritas do trabalho primeiro. */
export const listEntitiesForWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { work_id?: string | null }) =>
    z.object({ work_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: all, error } = await context.supabase
      .from("channeling_entities")
      .select("id, name, description, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    let favIds = new Set<string>();
    if (data.work_id) {
      const { data: favs } = await context.supabase
        .from("work_entity_favorites")
        .select("entity_id")
        .eq("work_id", data.work_id);
      favIds = new Set((favs ?? []).map((f) => f.entity_id));
    }
    const list = all ?? [];
    return [
      ...list.filter((e) => favIds.has(e.id)),
      ...list.filter((e) => !favIds.has(e.id)),
    ].map((e) => ({ ...e, is_favorite: favIds.has(e.id) }));
  });
