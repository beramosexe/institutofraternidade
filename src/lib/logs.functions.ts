import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, actor_id, entity, entity_id, action, diff, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((l) => l.actor_id).filter(Boolean) as string[]));
    const { data: profs } = ids.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    return (data ?? []).map((l) => ({ ...l, actor_name: l.actor_id ? nameOf.get(l.actor_id) ?? null : null }));
  });

