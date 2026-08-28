import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDisplayNames } from "@/lib/profile-names";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const REQUEST_STATUSES = [
  "open", "in_finance", "approved", "rejected", "postponed", "returned", "purchased", "cancelled",
] as const;

const itemSchema = z.object({
  item_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(140),
  unit: z.string().max(30).optional(),
  quantity: z.number().min(0),
  notes: z.string().max(300).optional(),
});

/* ---------------- Pedidos de compra ---------------- */

export const listPurchaseRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { mine?: boolean; pendingFinance?: boolean }) =>
    z.object({ mine: z.boolean().optional(), pendingFinance: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("purchase_requests")
      .select("*, purchase_request_items(id, item_id, name, unit, quantity, notes)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data?.mine) q = q.eq("requested_by", context.userId);
    if (data?.pendingFinance) q = q.eq("needs_finance", true).in("status", ["in_finance", "open"]);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const names = await resolveDisplayNames(
      context.supabase,
      (rows ?? []).flatMap((r) => [r.requested_by, r.decided_by]),
    );
    return (rows ?? []).map((r) => ({
      ...r,
      items: r.purchase_request_items ?? [],
      requested_by_name: r.requested_by ? (names[r.requested_by] ?? "—") : "—",
      decided_by_name: r.decided_by ? (names[r.decided_by] ?? "—") : null,
    }));
  });

export const createPurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string; justification?: string; priority?: string; needs_finance?: boolean;
    notes?: string; items: Array<z.input<typeof itemSchema>>;
  }) =>
    z.object({
      title: z.string().min(3).max(140),
      justification: z.string().max(1000).optional(),
      priority: z.enum(PRIORITIES).optional(),
      needs_finance: z.boolean().optional(),
      notes: z.string().max(600).optional(),
      items: z.array(itemSchema).min(1).max(60),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("purchase_requests")
      .insert({
        title: data.title,
        justification: data.justification ?? null,
        priority: data.priority ?? "normal",
        needs_finance: data.needs_finance ?? false,
        notes: data.notes ?? null,
        requested_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase.from("purchase_request_items").insert(
      data.items.map((i) => ({
        request_id: row.id,
        item_id: i.item_id ?? null,
        name: i.name,
        unit: i.unit ?? "unidade",
        quantity: i.quantity,
        notes: i.notes ?? null,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
    return row;
  });

export const updatePurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; decision_note?: string; needs_finance?: boolean; priority?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(REQUEST_STATUSES).optional(),
      decision_note: z.string().max(600).optional(),
      needs_finance: z.boolean().optional(),
      priority: z.enum(PRIORITIES).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const isDecision = ["approved", "rejected", "postponed", "returned"].includes(patch.status ?? "");
    if (patch.status === "returned" && !patch.decision_note?.trim()) {
      throw new Error("Informe o motivo ao devolver o pedido.");
    }
    const update: Record<string, unknown> = { ...patch };
    if (isDecision) {
      update["decided_by"] = context.userId;
      update["decided_at"] = new Date().toISOString();
    }
    const { error } = await context.supabase.from("purchase_requests").update(update as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Compras realizadas ---------------- */

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("purchases")
      .select("*, purchase_items(id, item_id, name, unit, quantity, unit_price, total_price), purchase_documents(id, storage_path, kind, mime_type)")
      .order("purchased_on", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const names = await resolveDisplayNames(context.supabase, (rows ?? []).map((r) => r.purchased_by));
    return (rows ?? []).map((r) => ({
      ...r,
      items: r.purchase_items ?? [],
      documents: r.purchase_documents ?? [],
      purchased_by_name: r.purchased_by ? (names[r.purchased_by] ?? "—") : "—",
    }));
  });

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    purchased_on: string; supplier?: string; notes?: string; request_id?: string | null;
    apply_to_stock?: boolean;
    items: Array<{ item_id?: string | null; name: string; unit?: string; quantity: number; unit_price?: number }>;
  }) =>
    z.object({
      purchased_on: z.string().min(4).max(30),
      supplier: z.string().max(140).optional(),
      notes: z.string().max(600).optional(),
      request_id: z.string().uuid().nullable().optional(),
      apply_to_stock: z.boolean().optional(),
      items: z.array(z.object({
        item_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(140),
        unit: z.string().max(30).optional(),
        quantity: z.number().min(0),
        unit_price: z.number().min(0).optional(),
      })).min(1).max(80),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const items = data.items.map((i) => ({
      item_id: i.item_id ?? null,
      name: i.name,
      unit: i.unit ?? "unidade",
      quantity: i.quantity,
      unit_price: i.unit_price ?? 0,
      total_price: Number(((i.unit_price ?? 0) * i.quantity).toFixed(2)),
    }));
    const total = Number(items.reduce((s, i) => s + i.total_price, 0).toFixed(2));

    const { data: row, error } = await context.supabase
      .from("purchases")
      .insert({
        purchased_on: data.purchased_on,
        supplier: data.supplier ?? null,
        notes: data.notes ?? null,
        request_id: data.request_id ?? null,
        total_amount: total,
        applied_to_stock: !!data.apply_to_stock,
        purchased_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase
      .from("purchase_items")
      .insert(items.map((i) => ({ ...i, purchase_id: row.id })));
    if (itemsError) throw new Error(itemsError.message);

    if (data.apply_to_stock) {
      for (const i of items) {
        if (!i.item_id) continue;
        await context.supabase.from("stock_movements").insert({
          item_id: i.item_id,
          type: "in",
          quantity: i.quantity,
          reason: `Compra${data.supplier ? ` — ${data.supplier}` : ""}`,
          created_by: context.userId,
        });
      }
    }

    if (data.request_id) {
      await context.supabase.from("purchase_requests")
        .update({ status: "purchased" }).eq("id", data.request_id);
    }
    return row;
  });

export const addPurchaseDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { purchase_id: string; storage_path: string; kind?: string; mime_type?: string; ai_suggestion?: unknown }) =>
    z.object({
      purchase_id: z.string().uuid(),
      storage_path: z.string().min(3).max(400),
      kind: z.string().max(40).optional(),
      mime_type: z.string().max(120).optional(),
      ai_suggestion: z.unknown().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("purchase_documents").insert({
      purchase_id: data.purchase_id,
      storage_path: data.storage_path,
      kind: data.kind ?? "nota",
      mime_type: data.mime_type ?? null,
      ai_suggestion: (data.ai_suggestion ?? null) as never,
      uploaded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPurchaseDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storage_path: string }) => z.object({ storage_path: z.string().min(3) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("documentos")
      .createSignedUrl(data.storage_path, 60 * 30);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
