import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_PERMISSIONS } from "@/lib/permissions";

/** Returns current user's roles + flat permission set + profile. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: userRoles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role_id, roles!inner(id, slug, name, role_permissions(permission))")
        .eq("user_id", userId),
    ]);

    const roles = (userRoles ?? []).map((r) => ({
      id: r.roles.id,
      slug: r.roles.slug,
      name: r.roles.name,
    }));

    const permSet = new Set<string>();
    const isAdmin = roles.some((r) => r.slug === "admin");
    if (isAdmin) {
      ALL_PERMISSIONS.forEach((p) => permSet.add(p));
    } else {
      for (const ur of userRoles ?? []) {
        for (const rp of ur.roles.role_permissions ?? []) {
          permSet.add(rp.permission);
        }
      }
    }

    const membershipStatus = (profile?.membership_status ?? "pending") as
      | "pending" | "active" | "inactive";

    return {
      userId,
      profile: profile ?? null,
      roles,
      isAdmin,
      membershipStatus,
      isPending: !isAdmin && membershipStatus === "pending",
      permissions: isAdmin || membershipStatus === "active" ? Array.from(permSet) : [],
    };
  });

/** Minha formação: turmas, períodos de atividade e linha do tempo. */
export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: memberships }, { data: periods }, { data: events }] = await Promise.all([
      supabase
        .from("class_members")
        .select("id, is_primary, purpose, joined_at, left_at, status, notes, classes(id, name, period, status, formation_levels(name))")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false }),
      supabase
        .from("member_status_periods")
        .select("id, status, started_on, ended_on, reason")
        .eq("user_id", userId)
        .order("started_on", { ascending: false }),
      supabase
        .from("member_events")
        .select("id, kind, title, details, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]);
    return {
      memberships: memberships ?? [],
      periods: periods ?? [],
      events: events ?? [],
    };
  });


/** Update own profile */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { full_name?: string; phone?: string; bio?: string; shortcuts?: string[] }) =>
    z.object({
      full_name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      bio: z.string().max(500).optional(),
      shortcuts: z.array(z.string()).max(6).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Bypass estrito de typagem para suportar nova coluna imediatamente no client
    const updatePayload: any = { ...data }; 
    const { error } = await supabase.from("profiles").update(updatePayload).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
