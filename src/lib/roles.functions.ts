import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const slugRe = /^[a-z0-9_-]+$/;

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roles")
      .select("id, slug, name, description, is_system, role_permissions(permission)")
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      ...r,
      permissions: (r.role_permissions ?? []).map((p) => p.permission),
    }));
  });

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; name: string; description?: string }) =>
    z.object({
      slug: z.string().min(2).max(40).regex(slugRe, "Use letras minúsculas, números, _ e -"),
      name: z.string().min(1).max(80),
      description: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("roles")
      .insert({ ...data, is_system: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "roles", entity_id: row.id, action: "create",
    });
    return row;
  });

export const updateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; description?: string | null; permissions: string[] }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(300).nullable().optional(),
      permissions: z.array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]])).max(50),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, permissions, ...patch } = data;
    if (Object.keys(patch).length > 0) {
      const { error } = await context.supabase.from("roles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    }
    await context.supabase.from("role_permissions").delete().eq("role_id", id);
    if (permissions.length > 0) {
      const { error } = await context.supabase.from("role_permissions").insert(
        permissions.map((p) => ({ role_id: id, permission: p as never })),
      );
      if (error) throw new Error(error.message);
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "roles", entity_id: id, action: "update",
      diff: { permissions } as never,
    });
    return { ok: true };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: role } = await context.supabase.from("roles").select("is_system").eq("id", data.id).maybeSingle();
    if (role?.is_system) throw new Error("Cargo do sistema não pode ser excluído.");
    const { error } = await context.supabase.from("roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ---------- Users ---------- */

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role_id, roles(id, slug, name)");

    const byUser = new Map<string, Array<{ id: string; slug: string; name: string }>>();
    for (const ur of userRoles ?? []) {
      const arr = byUser.get(ur.user_id) ?? [];
      arr.push({ id: ur.roles.id, slug: ur.roles.slug, name: ur.roles.name });
      byUser.set(ur.user_id, arr);
    }

    // fetch emails via admin (auth.users)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(users.users.map((u) => [u.id, u.email ?? ""]));

    return (profiles ?? []).map((p) => ({
      ...p,
      email: emailById.get(p.id) ?? "",
      roles: byUser.get(p.id) ?? [],
    }));
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role_ids: string[] }) =>
    z.object({ user_id: z.string().uuid(), role_ids: z.array(z.string().uuid()).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("user_roles").delete().eq("user_id", data.user_id);
    if (data.role_ids.length > 0) {
      const { error } = await supabase.from("user_roles").insert(
        data.role_ids.map((rid) => ({ user_id: data.user_id, role_id: rid, assigned_by: userId })),
      );
      if (error) throw new Error(error.message);
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId, entity: "user_roles", entity_id: data.user_id, action: "set",
      diff: { role_ids: data.role_ids } as never,
    });
    return { ok: true };
  });
