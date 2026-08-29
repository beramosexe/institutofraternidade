import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const listMyUploadTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audio_upload_tokens")
      .select("id, label, token_prefix, default_access_level, default_work_id, last_used_at, use_count, revoked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Cria um token pessoal para o Atalho do iPhone. O valor completo só aparece uma vez. */
export const createUploadToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    label: string;
    default_access_level: "public" | "associates" | "work_participants" | "attendees_only";
    default_work_id?: string | null;
  }) =>
    z.object({
      label: z.string().min(1).max(80),
      default_access_level: z.enum(["public", "associates", "work_participants", "attendees_only"]),
      default_work_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: canUpload } = await supabase.rpc("has_permission", {
      _user_id: userId, _permission: "audio.upload",
    });
    if (!canUpload) throw new Error("Você não tem permissão para enviar áudios.");

    const raw = `ifa_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const token_hash = await sha256Hex(raw);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("audio_upload_tokens")
      .insert({
        user_id: userId,
        label: data.label,
        token_hash,
        token_prefix: raw.slice(0, 12),
        default_access_level: data.default_access_level,
        default_work_id: data.default_work_id ?? null,
      })
      .select("id, label, token_prefix, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { ...row, token: raw };
  });

export const revokeUploadToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("audio_upload_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
