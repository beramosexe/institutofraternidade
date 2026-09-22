import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanManagePeople(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("can_manage_members", { _user_id: context.userId });
  if (!data) throw new Error("Sem permissão para gerenciar pessoas.");
}

export const listPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManagePeople(context);
    const { data, error } = await context.supabase
      .from("people")
      .select("id, full_name, phone, email, person_type, status, linked_user_id, notes, created_at, updated_at")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    full_name: string;
    phone?: string | null;
    email?: string | null;
    person_type: "visitor" | "associate";
    notes?: string | null;
  }) => z.object({
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    person_type: z.enum(["visitor", "associate"]),
    notes: z.string().trim().max(1000).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManagePeople(context);
    const { data: row, error } = await context.supabase
      .from("people")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    person_type?: "visitor" | "associate";
    status?: "active" | "inactive";
    notes?: string | null;
  }) => z.object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    person_type: z.enum(["visitor", "associate"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManagePeople(context);
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("people")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
