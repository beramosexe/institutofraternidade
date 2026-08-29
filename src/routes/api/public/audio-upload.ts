import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-upload-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 500 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extFromName(name: string, mime: string) {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (fromName && fromName.length <= 5) return fromName;
  const map: Record<string, string> = {
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    "audio/wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/aac": "aac",
  };
  return map[mime] ?? "m4a";
}

/**
 * Envio de áudio por token pessoal (Atalho do iPhone).
 * POST multipart/form-data: file, title?, description?, recorded_at?, work_id?, access_level?
 * Cabeçalho: x-upload-token: <token> (ou Authorization: Bearer <token>)
 */
export const Route = createFileRoute("/api/public/audio-upload")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-upload-token") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const token = header.trim();
        if (!token || token.length < 20) return json({ error: "Token ausente." }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token_hash = await sha256Hex(token);
        const { data: tokenRow } = await supabaseAdmin
          .from("audio_upload_tokens")
          .select("id, user_id, default_access_level, default_work_id, revoked_at, use_count")
          .eq("token_hash", token_hash)
          .maybeSingle();
        if (!tokenRow || tokenRow.revoked_at) return json({ error: "Token inválido ou revogado." }, 401);

        const { data: canUpload } = await supabaseAdmin.rpc("has_permission", {
          _user_id: tokenRow.user_id, _permission: "audio.upload",
        });
        if (!canUpload) return json({ error: "Usuário sem permissão de envio." }, 403);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Envie o arquivo como multipart/form-data." }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) return json({ error: "Arquivo ausente." }, 400);
        if (file.size > MAX_BYTES) return json({ error: "Arquivo maior que 500 MB." }, 400);

        const str = (k: string) => {
          const v = form.get(k);
          return typeof v === "string" && v.trim() ? v.trim() : null;
        };

        const accessInput = str("access_level");
        const allowed = ["public", "associates", "work_participants", "attendees_only"] as const;
        const access_level = (allowed as readonly string[]).includes(accessInput ?? "")
          ? (accessInput as (typeof allowed)[number])
          : tokenRow.default_access_level;

        const recorded = str("recorded_at");
        const recorded_at = recorded && /^\d{4}-\d{2}-\d{2}$/.test(recorded)
          ? recorded
          : new Date().toISOString().slice(0, 10);

        const workInput = str("work_id");
        const work_id =
          workInput && /^[0-9a-f-]{36}$/i.test(workInput) ? workInput : tokenRow.default_work_id;

        const ext = extFromName(file.name, file.type);
        const path = `${tokenRow.user_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabaseAdmin.storage
          .from("audios")
          .upload(path, file, { contentType: file.type || `audio/${ext}`, upsert: false });
        if (upErr) return json({ error: `Falha no armazenamento: ${upErr.message}` }, 500);

        const title = (str("title") ?? `Áudio do iPhone — ${recorded_at}`).slice(0, 200);

        const { data: row, error } = await supabaseAdmin
          .from("audios")
          .insert({
            title,
            description: str("description")?.slice(0, 2000) ?? null,
            work_id,
            recorded_at,
            audio_type: "canalizacao",
            access_level,
            storage_path: path,
            file_size_bytes: file.size,
            mime_type: file.type || `audio/${ext}`,
            uploaded_by: tokenRow.user_id,
            status: "transcribing",
          })
          .select("id, title")
          .single();
        if (error) {
          await supabaseAdmin.storage.from("audios").remove([path]);
          return json({ error: error.message }, 500);
        }

        await supabaseAdmin.from("processing_jobs").insert({
          audio_id: row.id, job_type: "transcribe", status: "pending",
        });
        await supabaseAdmin.from("audio_upload_tokens").update({
          last_used_at: new Date().toISOString(),
          use_count: (tokenRow.use_count ?? 0) + 1,
        }).eq("id", tokenRow.id);
        await supabaseAdmin.from("audit_logs").insert({
          actor_id: tokenRow.user_id, entity: "audios", entity_id: row.id, action: "upload_shortcut",
        });

        try {
          await supabaseAdmin.functions.invoke("transcribe-audio", { body: { audio_id: row.id } });
        } catch (e) {
          console.error("transcribe-audio invoke failed", e);
        }

        return json({ ok: true, id: row.id, title: row.title });
      },
    },
  },
});
