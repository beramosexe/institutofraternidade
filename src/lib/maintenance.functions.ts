import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDisplayNames } from "@/lib/profile-names";

const STATUSES = [
  "open", "analysis", "awaiting_quote", "quote_received", "sent_to_finance",
  "in_approval", "approved", "in_progress", "done", "rejected", "postponed",
  "cancelled", "returned",
] as const;

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const listMaintenanceTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { mine?: boolean }) => z.object({ mine: z.boolean().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("maintenance_tickets")
      .select("id, title, description, location, category, priority, status, created_by, assigned_to, created_at, updated_at, closed_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data?.mine) q = q.eq("created_by", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const names = await resolveDisplayNames(context.supabase, (rows ?? []).flatMap((r) => [r.created_by, r.assigned_to]));
    return (rows ?? []).map((r) => ({
      ...r,
      created_by_name: r.created_by ? (names[r.created_by] ?? "—") : "—",
      assigned_to_name: r.assigned_to ? (names[r.assigned_to] ?? "—") : null,
    }));
  });

export const getMaintenanceTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: ticket, error } = await context.supabase
      .from("maintenance_tickets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Chamado não encontrado.");

    const [{ data: quotes }, { data: events }] = await Promise.all([
      context.supabase
        .from("maintenance_quotes")
        .select("*")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("maintenance_ticket_events")
        .select("*")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
    ]);

    const names = await resolveDisplayNames(context.supabase, [
      ticket.created_by, ticket.assigned_to,
      ...(events ?? []).map((e) => e.actor_id),
      ...(quotes ?? []).map((q) => q.created_by),
      ...(quotes ?? []).map((q) => q.decided_by),
    ]);

    return {
      ticket: {
        ...ticket,
        created_by_name: ticket.created_by ? (names[ticket.created_by] ?? "—") : "—",
      },
      quotes: (quotes ?? []).map((q) => ({
        ...q,
        created_by_name: q.created_by ? (names[q.created_by] ?? "—") : "—",
        decided_by_name: q.decided_by ? (names[q.decided_by] ?? "—") : null,
      })),
      events: (events ?? []).map((e) => ({
        ...e,
        actor_name: e.actor_id ? (names[e.actor_id] ?? "—") : "Sistema",
      })),
    };
  });

export const createMaintenanceTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description?: string; location?: string; category?: string; priority?: string }) =>
    z.object({
      title: z.string().min(3).max(140),
      description: z.string().max(2000).optional(),
      location: z.string().max(140).optional(),
      category: z.string().max(60).optional(),
      priority: z.enum(PRIORITIES).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_tickets")
      .insert({
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        category: data.category ?? null,
        priority: data.priority ?? "normal",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("maintenance_ticket_events").insert({
      ticket_id: row.id, to_status: "open", note: "Chamado aberto", actor_id: context.userId,
    });
    return row;
  });

export const updateMaintenanceTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string; status?: string; note?: string; priority?: string;
    assigned_to?: string | null; location?: string | null; category?: string | null;
  }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUSES).optional(),
      note: z.string().max(600).optional(),
      priority: z.enum(PRIORITIES).optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      location: z.string().max(140).nullable().optional(),
      category: z.string().max(60).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, note, ...patch } = data;
    const { data: before } = await context.supabase
      .from("maintenance_tickets").select("status").eq("id", id).maybeSingle();

    if (patch.status === "returned" && !note?.trim()) {
      throw new Error("Informe o motivo ao devolver o chamado.");
    }

    const update: Record<string, unknown> = { ...patch };
    if (patch.status === "done") update["closed_at"] = new Date().toISOString();
    const { error } = await context.supabase.from("maintenance_tickets").update(update as never).eq("id", id);
    if (error) throw new Error(error.message);

    if (patch.status || note) {
      await context.supabase.from("maintenance_ticket_events").insert({
        ticket_id: id,
        from_status: before?.status ?? null,
        to_status: patch.status ?? before?.status ?? null,
        note: note ?? null,
        actor_id: context.userId,
      });
    }
    return { ok: true };
  });

export const addMaintenanceQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticket_id: string; supplier: string; amount: number; description?: string; deadline?: string; notes?: string; document_path?: string }) =>
    z.object({
      ticket_id: z.string().uuid(),
      supplier: z.string().min(2).max(140),
      amount: z.number().min(0),
      description: z.string().max(1000).optional(),
      deadline: z.string().max(80).optional(),
      notes: z.string().max(600).optional(),
      document_path: z.string().max(400).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("maintenance_quotes").insert({
      ticket_id: data.ticket_id,
      supplier: data.supplier,
      amount: data.amount,
      description: data.description ?? null,
      deadline: data.deadline ?? null,
      notes: data.notes ?? null,
      document_path: data.document_path ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("maintenance_tickets")
      .update({ status: "quote_received" }).eq("id", data.ticket_id);
    await context.supabase.from("maintenance_ticket_events").insert({
      ticket_id: data.ticket_id, to_status: "quote_received",
      note: `Orçamento de ${data.supplier} registrado`, actor_id: context.userId,
    });
    return { ok: true };
  });

export const sendQuoteToFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticket_id: string }) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("maintenance_tickets")
      .update({ status: "sent_to_finance" }).eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("maintenance_ticket_events").insert({
      ticket_id: data.ticket_id, to_status: "sent_to_finance",
      note: "Enviado ao financeiro", actor_id: context.userId,
    });
    return { ok: true };
  });

export const deleteMaintenanceQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("maintenance_quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
