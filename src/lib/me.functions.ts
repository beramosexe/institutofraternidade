import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      [
        "audio.upload","audio.edit_any","audio.delete","audio.publish","audio.reprocess",
        "transcription.review","transcription.approve","work.manage","user.manage",
        "role.manage","logs.view","attendance.manage",
      ].forEach((p) => permSet.add(p));
    } else {
      for (const ur of userRoles ?? []) {
        for (const rp of ur.roles.role_permissions ?? []) {
          permSet.add(rp.permission);
        }
      }
    }

    return {
      userId,
      profile: profile ?? null,
      roles,
      isAdmin,
      permissions: Array.from(permSet),
    };
  });

/** Update own profile */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { full_name?: string; phone?: string; bio?: string }) =>
    z.object({
      full_name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      bio: z.string().max(500).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
