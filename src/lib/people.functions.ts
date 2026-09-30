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


export const linkPersonToMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { person_id: string; user_id: string }) =>
    z.object({ person_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManagePeople(context);

    const { data: person, error: personError } = await context.supabase
      .from("people")
      .select("id, linked_user_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (personError) throw new Error(personError.message);
    if (!person) throw new Error("Pessoa não encontrada.");
    if (person.linked_user_id && person.linked_user_id !== data.user_id) {
      throw new Error("Esta pessoa já está vinculada a outro perfil.");
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", data.user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Perfil não encontrado.");

    const { data: linkedPerson, error: linkedError } = await context.supabase
      .from("people")
      .select("id")
      .eq("linked_user_id", data.user_id)
      .neq("id", data.person_id)
      .maybeSingle();
    if (linkedError) throw new Error(linkedError.message);
    if (linkedPerson) throw new Error("Este perfil já está vinculado a outra pessoa.");

    const { error } = await context.supabase
      .from("people")
      .update({
        linked_user_id: data.user_id,
        full_name: profile.full_name ?? undefined,
        phone: profile.phone ?? undefined,
        person_type: "associate",
        status: "active",
      })
      .eq("id", data.person_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
