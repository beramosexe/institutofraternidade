import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { list?: string; includeInactive?: boolean }) =>
    z.object({ list: z.string().max(60).optional(), includeInactive: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("options")
      .select("id, list, value, label, sort_order, is_active")
      .order("list")
      .order("sort_order")
      .order("label");
    if (data?.list) q = q.eq("list", data.list);
    if (!data?.includeInactive) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; list: string; label: string; value?: string; sort_order?: number; is_active?: boolean }) =>
    z.object({
      id: z.string().uuid().optional(),
      list: z.string().min(2).max(60),
      label: z.string().min(1).max(120),
      value: z.string().max(120).optional(),
      sort_order: z.number().int().min(0).max(999).optional(),
      is_active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const value = data.value?.trim() || data.label.trim().toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (data.id) {
      const { error } = await context.supabase
        .from("options")
        .update({ label: data.label, value, sort_order: data.sort_order ?? 0, is_active: data.is_active ?? true })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("options").insert({
      list: data.list,
      label: data.label,
      value,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("options").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
