import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSignedDownloadUrl, getSignedUploadUrl } from "@/lib/r2/storage.server";

/** Issues a short-lived R2 upload URL after validating audio upload permission. */
export const createAudioUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { file_name: string; mime_type: string }) =>
    z.object({
      file_name: z.string().min(1).max(255),
      mime_type: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: canUpload, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userId, _permission: "audio.upload",
    });
    if (permErr) throw new Error(permErr.message);
    if (!canUpload) throw new Error("Você não tem permissão para enviar áudios.");

    const rawExt = data.file_name.includes(".") ? data.file_name.split(".").pop() : "";
    const ext = rawExt && /^[a-z0-9]{1,8}$/i.test(rawExt) ? rawExt.toLowerCase() : "mp3";
    const key = `originals/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUploadUrl(key, 15 * 60, data.mime_type);

    return { key, uploadUrl };
  });

/** Create the DB row for an uploaded audio and trigger transcription. */
export const registerAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    description?: string;
    work_id?: string | null;
    recorded_at?: string | null;
    audio_type: "canalizacao" | "outro";
    message_source?: string;
    message_entity_id?: string | null;
    access_level: "public" | "associates" | "work_participants" | "attendees_only";
    storage_path: string;
    file_size_bytes: number;
    mime_type: string;
  }) =>
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      work_id: z.string().uuid().nullable().optional(),
      recorded_at: z.string().nullable().optional(),
      audio_type: z.enum(["canalizacao", "outro"]),
      message_source: z.string().max(200).optional(),
      message_entity_id: z.string().uuid().nullable().optional(),
      access_level: z.enum(["public", "associates", "work_participants", "attendees_only"]),
      storage_path: z.string().min(1),
      file_size_bytes: z.number().int().min(1).max(1024 * 1024 * 1024),
      mime_type: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.storage_path.startsWith(`originals/${userId}/`)) {
      throw new Error("Caminho de armazenamento inválido.");
    }
    // Verify upload permission server-side, then use admin client to bypass RLS
    // (RLS WITH CHECK uses auth.uid() which is unreliable across PostgREST when
    // using the new publishable key flow; we already trust `userId` from JWT).
    const { data: canUpload, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userId, _permission: "audio.upload",
    });
    if (permErr) throw new Error(permErr.message);
    if (!canUpload) throw new Error("Você não tem permissão para enviar áudios.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("audios")
      .insert({ ...data, uploaded_by: userId, status: "transcribing" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // processing_jobs / audit_logs block INSERT via RLS — use the admin client.
    const { error: jobErr } = await supabaseAdmin.from("processing_jobs").insert({
      audio_id: row.id, job_type: "transcribe", status: "pending",
    });
    if (jobErr) console.error("processing_jobs insert failed", jobErr.message);

    const { error: auditErr } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId, entity: "audios", entity_id: row.id, action: "upload",
      diff: { title: data.title, access_level: data.access_level } as never,
    });
    if (auditErr) console.error("audit_logs insert failed", auditErr.message);

    // Generate a short-lived R2 URL so the Edge Function can fetch the uploaded object.
    const audioUrl = await getSignedDownloadUrl(data.storage_path, 60 * 60);

    // Fire-and-forget edge function invocation.
    try {
      await supabase.functions.invoke("transcribe-audio", {
        body: { audio_id: row.id, audio_url: audioUrl },
      });
    } catch (e) {
      console.error("transcribe-audio invoke failed", e);
    }

    return row;
  });

/** Fails audios stuck in `transcribing` with a job running longer than the limit. */
export const failStaleTranscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audio_id?: string | null }) =>
    z.object({ audio_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const STALE_MINUTES = 15;
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const message =
      `A transcrição foi interrompida antes de terminar (sem resposta há mais de ${STALE_MINUTES} minutos). Tente transcrever novamente.`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("audios")
      .select("id, updated_at")
      .eq("status", "transcribing")
      .lt("updated_at", cutoff);
    if (data.audio_id) q = q.eq("id", data.audio_id);

    const { data: stuck, error } = await q;
    if (error) throw new Error(error.message);
    if (!stuck?.length) return { failed: 0 };

    const ids = stuck.map((a) => a.id);
    await supabaseAdmin
      .from("audios")
      .update({ status: "error", error_message: message })
      .in("id", ids);
    await supabaseAdmin
      .from("processing_jobs")
      .update({ status: "error", error_message: message, finished_at: new Date().toISOString() })
      .in("audio_id", ids)
      .eq("status", "running");

    return { failed: ids.length };
  });


/** Returns a short-lived signed URL for a private audio file the user can access. */
export const getAudioStreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audio_id: string }) =>
    z.object({ audio_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // RLS enforces access_level; if no row returned, deny.
    const { data: audio, error } = await supabase
      .from("audios")
      .select("id, storage_path")
      .eq("id", data.audio_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!audio) throw new Error("Áudio não encontrado ou sem acesso.");
    // Use admin signed URL because anon storage uses uploaded_by folder which differs from current user.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("audios")
      .createSignedUrl(audio.storage_path, 60 * 60);
    if (sErr) throw new Error(sErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId, entity: "audios", entity_id: audio.id, action: "stream",
    });

    return { url: signed.signedUrl };
  });

/** Public signed url for public audios (no auth required). */
export const getPublicAudioUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { audio_id: string }) =>
    z.object({ audio_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: audio } = await supabaseAdmin
      .from("audios")
      .select("id, storage_path, access_level, status")
      .eq("id", data.audio_id)
      .maybeSingle();
    if (!audio || audio.access_level !== "public" || audio.status !== "ready") {
      throw new Error("Áudio não disponível publicamente.");
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("audios")
      .createSignedUrl(audio.storage_path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/** Archive / restore / delete / reprocess */
export const updateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    patch: Partial<{
      title: string;
      description: string | null;
      access_level: "public" | "associates" | "work_participants" | "attendees_only";
      audio_type: "canalizacao" | "outro";
      message_source: string | null;
      recorded_at: string | null;
      work_id: string | null;
      status: "ready" | "archived" | "uploaded" | "transcribing" | "error";
    }>;
  }) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        access_level: z.enum(["public","associates","work_participants","attendees_only"]).optional(),
        audio_type: z.enum(["canalizacao","outro"]).optional(),
        message_source: z.string().max(200).nullable().optional(),
        recorded_at: z.string().nullable().optional(),
        work_id: z.string().uuid().nullable().optional(),
        status: z.enum(["ready","archived","uploaded","transcribing","error"]).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("audios").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "audios", entity_id: data.id, action: "update",
      diff: data.patch as never,
    });
    return { ok: true };
  });

export const deleteAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: audio } = await context.supabase.from("audios").select("storage_path").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("audios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (audio?.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("audios").remove([audio.storage_path]);
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "audios", entity_id: data.id, action: "delete",
    });
    return { ok: true };
  });

export const reprocessAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Authorize before using the admin client (which bypasses RLS).
    const { data: audioRow } = await context.supabase
      .from("audios").select("id, uploaded_by, storage_path").eq("id", data.id).maybeSingle();
    if (!audioRow) throw new Error("Áudio não encontrado ou sem acesso.");
    if (audioRow.uploaded_by !== context.userId) {
      const [{ data: canReprocess }, { data: canEdit }] = await Promise.all([
        context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "audio.reprocess" }),
        context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "audio.edit_any" }),
      ]);
      if (!canReprocess && !canEdit) throw new Error("Você não tem permissão para reprocessar este áudio.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // close any orphan job from a previous interrupted run
    await supabaseAdmin.from("processing_jobs").update({
      status: "error", error_message: "Substituído por novo reprocessamento.",
      finished_at: new Date().toISOString(),
    }).eq("audio_id", data.id).eq("status", "running");

    await supabaseAdmin.from("audios").update({ status: "transcribing", error_message: null }).eq("id", data.id);
    await supabaseAdmin.from("processing_jobs").insert({
      audio_id: data.id, job_type: "transcribe", status: "pending",
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, entity: "audios", entity_id: data.id, action: "reprocess",
    });

    const audioUrl = await getSignedDownloadUrl(
      audioRow.storage_path,
      60 * 60,
    );

    try {
      await context.supabase.functions.invoke("transcribe-audio", {
        body: { audio_id: data.id, audio_url: audioUrl },
      });
    } catch (e) { console.error(e); }
    return { ok: true };
  });

/** Conta uma reprodução (usado pelo player). */
export const registerAudioPlay = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("register_audio_play", { _audio_id: data.id });
    if (error) console.error("register_audio_play failed", error.message);
    return { ok: true };
  });

/** Marca/desmarca um áudio como destaque da biblioteca. */
export const setAudioFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; featured: boolean }) =>
    z.object({ id: z.string().uuid(), featured: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: canEdit } = await context.supabase.rpc("has_permission", {
      _user_id: context.userId, _permission: "audio.edit_any",
    });
    if (!canEdit) throw new Error("Você não tem permissão para destacar áudios.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("audios").update({ is_featured: data.featured }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

