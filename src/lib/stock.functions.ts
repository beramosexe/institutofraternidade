import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listStockItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stock_items")
      .select("id, name, category, unit, quantity, min_quantity, location, notes, is_active, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; category?: string; unit?: string; min_quantity?: number; location?: string; notes?: string }) =>
    z.object({
      name: z.string().min(2).max(120),
      category: z.string().max(60).optional(),
      unit: z.string().max(12).optional(),
      min_quantity: z.number().min(0).optional(),
      location: z.string().max(120).optional(),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("stock_items")
      .insert({
        name: data.name,
        category: data.category ?? null,
        unit: data.unit ?? "un",
        min_quantity: data.min_quantity ?? 0,
        location: data.location ?? null,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; category?: string; unit?: string; min_quantity?: number; location?: string; notes?: string; is_active?: boolean }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(120).optional(),
      category: z.string().max(60).nullable().optional(),
      unit: z.string().max(12).optional(),
      min_quantity: z.number().min(0).optional(),
      location: z.string().max(120).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
      is_active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("stock_items").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("stock_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: string; type: "in" | "out" | "adjustment"; quantity: number; reason?: string; work_id?: string | null }) =>
    z.object({
      item_id: z.string().uuid(),
      type: z.enum(["in", "out", "adjustment"]),
      quantity: z.number().min(0),
      reason: z.string().max(300).optional(),
      work_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("stock_movements")
      .insert({
        item_id: data.item_id,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason ?? null,
        work_id: data.work_id ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { item_id?: string }) =>
    z.object({ item_id: z.string().uuid().optional() }).optional().parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("stock_movements")
      .select("id, item_id, type, quantity, reason, work_id, created_by, created_at, stock_items(name, unit), works(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data?.item_id) q = q.eq("item_id", data.item_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Resolve display names for created_by via safe RPC (profiles são restritos)
    const userIds = [...new Set((rows ?? []).map((r: any) => r.created_by).filter(Boolean))] as string[];
    const names: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const { data: p } = await context.supabase.rpc("get_profile_display", { _user_id: uid });
        const row = Array.isArray(p) ? p[0] : p;
        if (row?.full_name) names[uid] = row.full_name;
      }),
    );

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      item_id: r.item_id,
      item_name: r.stock_items?.name ?? "—",
      unit: r.stock_items?.unit ?? "",
      type: r.type,
      quantity: r.quantity,
      reason: r.reason,
      work_name: r.works?.name ?? null,
      created_by_name: r.created_by ? (names[r.created_by] ?? "—") : "—",
      created_at: r.created_at,
    }));
  });
