import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  scheduled_at: z.string().datetime(),
  work_id: z.string().uuid().nullable().optional(),
});

async function requireAttendanceAccess(context: any) {
  const { data } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "attendance.manage" });
  if (!data) throw new Error("Você não tem permissão para gerir listas de presença.");
}

export const listAttendanceLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAttendanceAccess(context);
    const db: any = context.supabase;
    const { data, error } = await db.from("attendance_lists")
      .select("id, title, description, scheduled_at, work_id, works(name), attendance_list_entries(id, present)")
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAttendanceList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAttendanceAccess(context);
    const db: any = context.supabase;
    const { data: list, error } = await db.from("attendance_lists")
      .select("id, title, description, scheduled_at, work_id, works(name), attendance_list_entries(id, user_id, guest_name, expected, present, checked_in_at)")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const ids = (list.attendance_list_entries ?? []).map((e: any) => e.user_id).filter(Boolean);
    let profiles: any[] = [];
    if (ids.length) ({ data: profiles = [] } = await db.from("profiles").select("id, full_name, avatar_url").in("id", ids));
    const names = new Map(profiles.map((p: any) => [p.id, p]));
    return { ...list, entries: (list.attendance_list_entries ?? []).map((e: any) => ({ ...e, profile: e.user_id ? names.get(e.user_id) ?? null : null })) };
  });

export const createAttendanceList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof listInput>) => listInput.parse(d))
  .handler(async ({ context, data }) => {
    await requireAttendanceAccess(context);
    const db: any = context.supabase;
    const { data: list, error } = await db.from("attendance_lists").insert({ ...data, created_by: context.userId }).select().single();
    if (error) throw new Error(error.message);
    if (data.work_id) {
      const { data: participants = [] } = await db.from("work_participants").select("user_id").eq("work_id", data.work_id);
      if (participants.length) await db.from("attendance_list_entries").insert(participants.map((p: any) => ({ list_id: list.id, user_id: p.user_id, expected: true })));
    }
    return list;
  });

export const addAttendanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { list_id: string; user_id?: string | null; guest_name?: string | null; expected?: boolean }) => z.object({
    list_id: z.string().uuid(), user_id: z.string().uuid().nullable().optional(),
    guest_name: z.string().trim().min(1).max(120).nullable().optional(), expected: z.boolean().optional(),
  }).refine(v => !!v.user_id || !!v.guest_name, "Informe uma pessoa.").parse(d))
  .handler(async ({ context, data }) => {
    await requireAttendanceAccess(context);
    const db: any = context.supabase;
    const { error } = await db.from("attendance_list_entries").insert({ ...data, user_id: data.user_id ?? null, guest_name: data.user_id ? null : data.guest_name ?? null });
    if (error) throw new Error(error.code === "23505" ? "Esta pessoa já está na lista." : error.message);
    return { ok: true };
  });

export const setAttendanceEntryPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; present: boolean }) => z.object({ id: z.string().uuid(), present: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAttendanceAccess(context);
    const db: any = context.supabase;
    const { error } = await db.from("attendance_list_entries").update({ present: data.present, checked_in_at: data.present ? new Date().toISOString() : null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });