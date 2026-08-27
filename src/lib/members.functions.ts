import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CRITICAL_PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";

async function assertCanManageMembers(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("can_manage_members", { _user_id: context.userId });
  if (!data) throw new Error("Sem permissão para gerenciar associados.");
}

async function isAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  return !!data;
}

async function logEvent(
  context: { supabase: any; userId: string },
  userId: string,
  kind: string,
  title: string,
  details?: Record<string, unknown>,
) {
  await context.supabase.from("member_events").insert({
    user_id: userId,
    kind,
    title,
    details: (details ?? null) as never,
    actor_id: context.userId,
  });
  await context.supabase.from("audit_logs").insert({
    actor_id: context.userId,
    entity: "members",
    entity_id: userId,
    action: kind,
    diff: (details ?? null) as never,
  });
}

/** Lista de associados com status, turma atual, nível e cargos. */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageMembers(context);
    const { supabase } = context;

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, membership_status, validated_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      supabase.from("user_roles").select("user_id, roles(id, slug, name)"),
      supabase
        .from("class_members")
        .select("user_id, is_primary, status, joined_at, classes(id, name, formation_levels(name))")
        .eq("status", "active"),
    ]);

    const rolesByUser = new Map<string, Array<{ id: string; slug: string; name: string }>>();
    for (const ur of userRoles ?? []) {
      const arr = rolesByUser.get(ur.user_id) ?? [];
      if (ur.roles) arr.push({ id: ur.roles.id, slug: ur.roles.slug, name: ur.roles.name });
      rolesByUser.set(ur.user_id, arr);
    }

    const classesByUser = new Map<string, Array<{ name: string; level: string | null; primary: boolean }>>();
    for (const cm of memberships ?? []) {
      const arr = classesByUser.get(cm.user_id) ?? [];
      arr.push({
        name: cm.classes?.name ?? "—",
        level: cm.classes?.formation_levels?.name ?? null,
        primary: cm.is_primary,
      });
      classesByUser.set(cm.user_id, arr);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    const emailById = new Map(users.users.map((u) => [u.id, u.email ?? ""]));

    return (profiles ?? []).map((p) => ({
      ...p,
      email: emailById.get(p.id) ?? "",
      roles: rolesByUser.get(p.id) ?? [],
      classes: classesByUser.get(p.id) ?? [],
    }));
  });

/** Ficha completa do associado. */
export const getMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManageMembers(context);
    const { supabase } = context;

    const [{ data: profile }, { data: memberships }, { data: periods }, { data: events }, { data: userRoles }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
        supabase
          .from("class_members")
          .select("id, is_primary, purpose, joined_at, left_at, status, notes, classes(id, name, period, status, formation_levels(name))")
          .eq("user_id", data.user_id)
          .order("joined_at", { ascending: false }),
        supabase
          .from("member_status_periods")
          .select("id, status, started_on, ended_on, reason")
          .eq("user_id", data.user_id)
          .order("started_on", { ascending: false }),
        supabase
          .from("member_events")
          .select("id, kind, title, details, occurred_at, actor_id")
          .eq("user_id", data.user_id)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.from("user_roles").select("role_id").eq("user_id", data.user_id),
      ]);

    if (!profile) throw new Error("Associado não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);

    return {
      profile,
      email: authUser?.user?.email ?? "",
      role_ids: (userRoles ?? []).map((r) => r.role_id),
      memberships: memberships ?? [],
      periods: periods ?? [],
      events: events ?? [],
    };
  });

/** Valida um cadastro pendente e configura a conta. */
export const validateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role_ids?: string[]; class_id?: string | null; purpose?: string }) =>
    z.object({
      user_id: z.string().uuid(),
      role_ids: z.array(z.string().uuid()).max(50).optional(),
      class_id: z.string().uuid().nullable().optional(),
      purpose: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageMembers(context);
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("profiles")
      .update({ membership_status: "active", validated_at: new Date().toISOString(), validated_by: userId })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabase.from("member_status_periods").insert({
      user_id: data.user_id,
      status: "active",
      reason: "Cadastro validado",
      changed_by: userId,
    });

    if (data.role_ids?.length) {
      await setMemberRolesInternal(context, data.user_id, data.role_ids);
    }

    if (data.class_id) {
      await supabase.from("class_members").insert({
        class_id: data.class_id,
        user_id: data.user_id,
        purpose: data.purpose ?? null,
        changed_by: userId,
      });
    }

    await logEvent(context, data.user_id, "member.validated", "Cadastro validado e conta configurada");
    return { ok: true };
  });

async function setMemberRolesInternal(
  context: { supabase: any; userId: string },
  targetUser: string,
  roleIds: string[],
) {
  const { supabase, userId } = context;
  const admin = await isAdmin(context);

  // Cargos que contêm permissões críticas só podem ser atribuídos pela administração.
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("role_id, permission")
    .in("role_id", roleIds.length ? roleIds : ["00000000-0000-0000-0000-000000000000"]);

  const criticalRoleIds = new Set(
    (rolePerms ?? [])
      .filter((rp: { permission: string }) => (CRITICAL_PERMISSIONS as string[]).includes(rp.permission))
      .map((rp: { role_id: string }) => rp.role_id),
  );

  const { data: adminRole } = await supabase.from("roles").select("id").eq("slug", "admin").maybeSingle();
  if (adminRole?.id && roleIds.includes(adminRole.id)) criticalRoleIds.add(adminRole.id);

  const { data: current } = await supabase.from("user_roles").select("role_id").eq("user_id", targetUser);
  const currentIds = new Set((current ?? []).map((r: { role_id: string }) => r.role_id));

  if (!admin) {
    if (targetUser === userId) throw new Error("Você não pode alterar seus próprios cargos.");
    for (const rid of criticalRoleIds) {
      if (!currentIds.has(rid)) {
        throw new Error("Cargos com permissões críticas só podem ser atribuídos pela administração.");
      }
    }
    for (const rid of currentIds as Set<string>) {
      if (criticalRoleIds.has(rid) && !roleIds.includes(rid)) {
        throw new Error("Cargos com permissões críticas só podem ser alterados pela administração.");
      }
    }
  }

  await supabase.from("user_roles").delete().eq("user_id", targetUser);
  if (roleIds.length) {
    const { error } = await supabase
      .from("user_roles")
      .insert(roleIds.map((rid) => ({ user_id: targetUser, role_id: rid, assigned_by: userId })));
    if (error) throw new Error(error.message);
  }
}

/** Define os cargos/funções de um associado. */
export const setMemberRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role_ids: string[] }) =>
    z.object({ user_id: z.string().uuid(), role_ids: z.array(z.string().uuid()).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageMembers(context);
    await setMemberRolesInternal(context, data.user_id, data.role_ids);
    await logEvent(context, data.user_id, "member.roles_changed", "Funções alteradas", {
      role_ids: data.role_ids,
    });
    return { ok: true };
  });

/** Ativa ou inativa um associado, registrando o período. */
export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; status: "active" | "inactive"; reason?: string }) =>
    z.object({
      user_id: z.string().uuid(),
      status: z.enum(["active", "inactive"]),
      reason: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageMembers(context);
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Você não pode alterar seu próprio status.");

    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("member_status_periods")
      .update({ ended_on: today })
      .eq("user_id", data.user_id)
      .is("ended_on", null);

    const { error } = await supabase
      .from("profiles")
      .update({ membership_status: data.status })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabase.from("member_status_periods").insert({
      user_id: data.user_id,
      status: data.status,
      started_on: today,
      reason: data.reason ?? null,
      changed_by: userId,
    });

    await logEvent(
      context,
      data.user_id,
      data.status === "active" ? "member.reactivated" : "member.deactivated",
      data.status === "active" ? "Associado reativado" : "Associado inativado",
      { reason: data.reason ?? null },
    );
    return { ok: true };
  });

/** Atualiza dados administrativos do associado. */
export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; full_name?: string; phone?: string | null }) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().min(1).max(120).optional(),
      phone: z.string().max(40).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageMembers(context);
    const { user_id, ...patch } = data;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", user_id);
    if (error) throw new Error(error.message);
    await logEvent(context, user_id, "member.updated", "Dados administrativos atualizados", patch);
    return { ok: true };
  });

/** Permissões críticas configuradas no sistema. */
export const listCriticalPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("critical_permissions").select("permission, note");
    return (data ?? []).map((r: { permission: string; note: string | null }) => r);
  });

/** Marca/desmarca uma permissão como crítica (somente administração). */
export const setPermissionCritical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { permission: string; critical: boolean }) =>
    z.object({
      permission: z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]),
      critical: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context))) throw new Error("Somente a administração pode definir permissões críticas.");
    if (data.critical) {
      await context.supabase
        .from("critical_permissions")
        .upsert({ permission: data.permission as never }, { onConflict: "permission" });
    } else {
      await context.supabase.from("critical_permissions").delete().eq("permission", data.permission as never);
    }
    return { ok: true };
  });

/** Contagem de cadastros aguardando validação. */
export const countPendingMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("membership_status", "pending");
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  });
