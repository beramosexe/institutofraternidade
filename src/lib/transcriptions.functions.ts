import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeWithGemini } from "@/lib/transcription-normalization/gemini";
import { prepareNormalizationInput } from "@/lib/transcription-normalization/prepare";
import { validateNormalizationGroups } from "@/lib/transcription-normalization/validate";
import { checkAndImproveNormalization } from "@/lib/transcription-normalization/quality-check";
import type { RawTranscriptSegment } from "@/lib/transcription-normalization/types";

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


const normalizeSchema = z.object({
  transcription_id: z.string().uuid(),
});

export const normalizeTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof normalizeSchema>) => normalizeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: transcription, error: fetchError } = await supabase
      .from("audio_transcriptions")
      .select("id, raw_segments, normalized_segments, normalized_text")
      .eq("id", data.transcription_id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!transcription) throw new Error("Transcrição não encontrada ou sem acesso.");

    const source = (Array.isArray(transcription.raw_segments)
      ? transcription.raw_segments
      : []) as RawTranscriptSegment[];

    if (!source.length) {
      throw new Error("Esta transcrição não possui segmentos RAW para normalizar.");
    }

    for (const [index, segment] of source.entries()) {
      if (
        typeof segment?.start !== "number" ||
        typeof segment?.end !== "number" ||
        typeof segment?.text !== "string"
      ) {
        throw new Error(`Segmento RAW inválido no índice ${index}.`);
      }
    }

    await supabase
      .from("audio_transcriptions")
      .update({ normalization_status: "in_progress" })
      .eq("id", data.transcription_id);

    try {
      const prepared = prepareNormalizationInput(source);
      // Layer 1: reconstruct sentence-level transcript units from ASR fragments.
      const draftGroups = await normalizeWithGemini(prepared);
      validateNormalizationGroups(draftGroups, source);

      // Layer 2: independent editorial quality check against RAW source and draft.
      const checkedGroups = await checkAndImproveNormalization(source, draftGroups);
      const normalized = validateNormalizationGroups(checkedGroups, source);
      const normalizedText = normalized.map((segment) => segment.text).join(" ").trim();
      const suspiciousFragments = normalized.filter((segment) => {
        const clean = segment.text.trim();
        const wordCount = clean.split(/\s+/).filter(Boolean).length;
        const hasSentenceEnding = /[.!?…]$/.test(clean);
        return wordCount <= 4 && !hasSentenceEnding;
      }).length;
      const fragmentationWarning =
        (normalized.length >= 8 && suspiciousFragments / normalized.length > 0.15) ||
        (source.length >= 12 && normalized.length / source.length > 0.85);
      const qualityMetrics = {
        rawSegments: source.length,
        draftGroups: draftGroups.length,
        finalGroups: normalized.length,
        groupingReductionPercent: source.length > 0
          ? Math.round((1 - normalized.length / source.length) * 100)
          : 0,
        averageSourceSegmentsPerGroup: normalized.length > 0
          ? Number((source.length / normalized.length).toFixed(2))
          : 0,
        suspiciousFragments,
        qualityStatus: fragmentationWarning ? "warning" : "ok",
        checkedByGemini: true,
      };

      const { error: updateError } = await supabase
        .from("audio_transcriptions")
        .update({
          normalized_segments: normalized,
          normalized_text: normalizedText,
          // Keep legacy consumer fields in sync so every user-facing surface
          // (including older list/search/copy flows) receives the normalized text.
          segments: normalized as never,
          text: normalizedText,
          normalization_status: "normalized",
        })
        .eq("id", data.transcription_id);

      if (updateError) throw new Error(updateError.message);

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        entity: "audio_transcriptions",
        entity_id: data.transcription_id,
        action: "normalization_generated",
        diff: qualityMetrics as never,
      });

      return {
        ok: true,
        sourceSegments: prepared.length,
        normalizedSegments: normalized.length,
        quality: qualityMetrics,
      };
    } catch (error) {
      await supabase
        .from("audio_transcriptions")
        .update({ normalization_status: "not_started" })
        .eq("id", data.transcription_id);

      throw error instanceof Error
        ? error
        : new Error("Erro desconhecido ao normalizar a transcrição.");
    }
  });
