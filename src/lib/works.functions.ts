import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  status: z.enum(["draft", "published", "completed", "archived"]),
  visibility: z.enum(["public", "internal"]),
});

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

export const createWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof workInput>) => workInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("works")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: row.id, action: "create",
      diff: data as never,
    });
    return row;
  });

export const updateWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: z.infer<typeof workInput> }) =>
    z.object({ id: z.string().uuid(), patch: workInput }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("works").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "works", entity_id: data.id, action: "update",
      diff: data.patch as never,
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
