import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LogErrorInput = {
  category: string;
  event: string;
  message: string;
  userId?: string | null;
  audioId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

async function persistSystemError(input: LogErrorInput) {
  const requestId = input.requestId ?? randomUUID();
  const { error } = await supabaseAdmin.from("system_error_logs").insert({
    category: input.category.slice(0, 80),
    event: input.event.slice(0, 120),
    message: input.message.slice(0, 2000),
    user_id: input.userId ?? null,
    audio_id: input.audioId ?? null,
    request_id: requestId,
    metadata: (input.metadata ?? {}) as never,
  });

  if (error) {
    console.error("[SystemErrorLog] Falha ao persistir erro", error.message, input);
  }

  return requestId;
}

export async function recordSystemError(input: LogErrorInput) {
  return persistSystemError(input);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const clientLogSchema = z.object({
  category: z.string().min(1).max(80),
  event: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  audioId: z.string().uuid().nullable().optional(),
  requestId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const reportSystemError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientLogSchema.parse(input))
  .handler(async ({ context, data }) => {
    return persistSystemError({
      ...data,
      userId: context.userId,
    });
  });

export const listSystemErrorLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: adminErr } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Acesso negado.");

    const { data, error } = await supabaseAdmin
      .from("system_error_logs")
      .select("id, created_at, category, event, message, user_id, audio_id, request_id, metadata")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set(
      (data ?? []).map((row) => row.user_id).filter(Boolean) as string[],
    ));

    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

    return (data ?? []).map((row) => ({
      ...row,
      user_name: row.user_id ? names.get(row.user_id) ?? null : null,
    }));
  });

export const clearSystemErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { before?: string | null }) =>
    z.object({ before: z.string().datetime().nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminErr } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Acesso negado.");

    let query = supabaseAdmin.from("system_error_logs").delete().not("id", "is", null);
    if (data.before) query = query.lt("created_at", data.before);

    const { error } = await query;
    if (error) throw new Error(error.message);

    return { ok: true };
  });
