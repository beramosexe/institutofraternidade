import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      access_level: z.enum(["public", "associates", "work_participants", "attendees_only"]),
      storage_path: z.string().min(1),
      file_size_bytes: z.number().int().min(1).max(1024 * 1024 * 1024),
      mime_type: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("audios")
      .insert({
        ...data,
        uploaded_by: userId,
        status: "transcribing",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("processing_jobs").insert({
      audio_id: row.id, job_type: "transcribe", status: "pending",
    });
    await supabase.from("audit_logs").insert({
      actor_id: userId, entity: "audios", entity_id: row.id, action: "upload",
      diff: { title: data.title, access_level: data.access_level } as never,
    });

    // Fire-and-forget edge function invocation
    try {
      await supabase.functions.invoke("transcribe-audio", { body: { audio_id: row.id } });
    } catch (e) {
      console.error("transcribe-audio invoke failed", e);
    }

    return row;
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
    await context.supabase.from("audios").update({ status: "transcribing", error_message: null }).eq("id", data.id);
    await context.supabase.from("processing_jobs").insert({
      audio_id: data.id, job_type: "transcribe", status: "pending",
    });
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "audios", entity_id: data.id, action: "reprocess",
    });
    try {
      await context.supabase.functions.invoke("transcribe-audio", { body: { audio_id: data.id } });
    } catch (e) { console.error(e); }
    return { ok: true };
  });
