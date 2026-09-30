import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const segmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

const saveSchema = z.object({
  transcription_id: z.string().uuid(),
  segments: z.array(segmentSchema).max(5000),
  note: z.string().max(500).optional(),
});

export const saveTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof saveSchema>) => saveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: before } = await supabase
      .from("audio_transcriptions")
      .select("segments, normalized_segments, version")
      .eq("id", data.transcription_id)
      .maybeSingle();

    const text = data.segments.map((s) => s.text).join(" ").trim();
    const { error } = await supabase
      .from("audio_transcriptions")
      .update({
        normalized_segments: data.segments as never,
        normalized_text: text,
        normalization_status: "normalized",
        // Legacy compatibility fields mirror the current normalized representation.
        segments: data.segments as never,
        text,
        review_status: "in_review",
        version: (before?.version ?? 1) + 1,
      })
      .eq("id", data.transcription_id);
    if (error) throw new Error(error.message);

    await supabase.from("transcription_revisions").insert({
      transcription_id: data.transcription_id,
      editor_id: userId,
      segments_before: (before?.normalized_segments ?? before?.segments ?? null) as never,
      segments_after: data.segments as never,
      note: data.note,
    });

    return { ok: true };
  });

export const markTranscriptionReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transcription_id: string; reviewed: boolean }) =>
    z.object({ transcription_id: z.string().uuid(), reviewed: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("audio_transcriptions")
      .update({
        review_status: data.reviewed ? "reviewed" : "unreviewed",
        normalization_status: data.reviewed ? "reviewed" : "normalized",
        reviewed_by: data.reviewed ? userId : null,
        reviewed_at: data.reviewed ? new Date().toISOString() : null,
      })
      .eq("id", data.transcription_id);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      entity: "audio_transcriptions",
      entity_id: data.transcription_id,
      action: data.reviewed ? "review_approved" : "review_reopened",
    });
    return { ok: true };
  });
