// Edge function: transcribes audio from R2 using Deepgram Nova-3.
// Triggered after upload from src/lib/audios.functions.ts -> registerAudio
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  audio_id: string;
  audio_url: string;
}

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

const TRANSCRIPTION_MODEL = "nova-3";
const PROVIDER_LABEL = "deepgram:nova-3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let currentAudioId: string | null = null;

  try {
    const { audio_id, audio_url } = (await req.json()) as Body;
    if (!audio_id) return json({ error: "audio_id required" }, 400);
    if (!audio_url) return json({ error: "audio_url required" }, 400);
    currentAudioId = audio_id;

    const signedUrl = new URL(audio_url);
    if (
      signedUrl.protocol !== "https:" ||
      !signedUrl.hostname.endsWith(".r2.cloudflarestorage.com")
    ) {
      throw new Error("Invalid R2 audio URL");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: audio, error: aErr } = await supabase
      .from("audios")
      .select("id, storage_path, mime_type")
      .eq("id", audio_id)
      .maybeSingle();

    if (aErr || !audio) throw new Error("Audio not found");

    // Mark job running (close orphan jobs from previous interrupted runs first)
    await supabase.from("processing_jobs").update({
      status: "error",
      error_message: "Execução anterior interrompida.",
      finished_at: new Date().toISOString(),
    }).eq("audio_id", audio_id).eq("status", "running");

    await supabase.from("audios")
      .update({ status: "transcribing", error_message: null })
      .eq("id", audio_id);

    await supabase.from("processing_jobs").update({
      status: "done",
      finished_at: new Date().toISOString(),
    }).eq("audio_id", audio_id).eq("status", "pending");

    await supabase.from("processing_jobs").insert({
      audio_id,
      job_type: "transcribe",
      status: "running",
      started_at: new Date().toISOString(),
    });

    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) throw new Error("DEEPGRAM_API_KEY missing");

    // Deepgram fetches the signed R2 URL directly. This avoids loading large
    // originals into the Edge Function memory.
    const params = new URLSearchParams({
      model: TRANSCRIPTION_MODEL,
      language: "pt-BR",
      smart_format: "true",
      punctuate: "true",
      paragraphs: "true",
      utterances: "true",
      diarize_model: "latest",
    });

    console.log(`Transcribing ${audio_id} with Deepgram Nova-3 (${audio.mime_type ?? "unknown mime"})`);

    let resp: Response;
    try {
      resp = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: audio_url }),
        signal: AbortSignal.timeout(4 * 60 * 1000),
      });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "TimeoutError";
      throw new Error(
        aborted
          ? "A transcrição excedeu o tempo limite de 4 minutos. Tente novamente ou envie um arquivo menor."
          : `Falha de rede ao chamar o Deepgram: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 401) throw new Error("Chave da API do Deepgram inválida ou não autorizada.");
      if (resp.status === 402) throw new Error("Créditos do Deepgram esgotados.");
      if (resp.status === 429) throw new Error("Limite de uso do Deepgram atingido. Tente novamente em alguns minutos.");
      throw new Error(`Deepgram ${resp.status}: ${t.slice(0, 500)}`);
    }

    const dg = await resp.json();
    console.log("Deepgram response keys:", Object.keys(dg));

    // Prefer sentence-level timestamps from Deepgram Paragraphs.
    // This produces readable synced chunks instead of one segment per word.
    const alternative = dg?.results?.channels?.[0]?.alternatives?.[0];
    const paragraphGroups = alternative?.paragraphs?.paragraphs;
    const sentenceSegments: Segment[] = Array.isArray(paragraphGroups)
      ? paragraphGroups.flatMap((paragraph: {
          sentences?: Array<{ start: number; end: number; text: string }>;
        }) =>
          Array.isArray(paragraph.sentences)
            ? paragraph.sentences.map((sentence) => ({
                start: Number(sentence.start),
                end: Number(sentence.end),
                text: String(sentence.text ?? "").trim(),
              }))
            : [],
        ).filter(
          (s: Segment) =>
            s.text.length > 0 &&
            Number.isFinite(s.start) &&
            Number.isFinite(s.end) &&
            s.end > s.start,
        )
      : [];

    const rawUtterances = dg?.results?.utterances;
    const utteranceSegments: Segment[] = Array.isArray(rawUtterances)
      ? rawUtterances.map((u: {
          start: number;
          end: number;
          transcript: string;
          speaker?: number;
        }) => ({
          start: Number(u.start),
          end: Number(u.end),
          text: String(u.transcript ?? "").trim(),
          ...(u.speaker !== undefined ? { speaker: Number(u.speaker) } : {}),
        })).filter((s: Segment) => s.text.length > 0)
      : [];

    const segments =
      sentenceSegments.length > 0
        ? sentenceSegments
        : utteranceSegments;

    const fallbackText =
      alternative?.transcript ?? "";

    const text = String(fallbackText).trim() || segments.map((s) => s.text).join(" ").trim();

    if (!text) {
      throw new Error("Transcription returned empty text");
    }

    const language =
      dg?.results?.channels?.[0]?.detected_language ??
      dg?.results?.channels?.[0]?.alternatives?.[0]?.language ??
      "pt-BR";

    const duration =
      dg?.metadata?.duration ??
      dg?.results?.channels?.[0]?.alternatives?.[0]?.duration ??
      null;

    const { data: existing } = await supabase
      .from("audio_transcriptions")
      .select("id")
      .eq("audio_id", audio_id)
      .maybeSingle();

    if (existing) {
      await supabase.from("audio_transcriptions").update({
        text,
        segments: segments as never,
        language,
        provider: PROVIDER_LABEL,
        review_status: "unreviewed",
      }).eq("id", existing.id);
    } else {
      await supabase.from("audio_transcriptions").insert({
        audio_id,
        text,
        segments: segments as never,
        language,
        provider: PROVIDER_LABEL,
      });
    }

    await supabase.from("audios")
      .update({ status: "ready", error_message: null })
      .eq("id", audio_id);

    await supabase.from("processing_jobs").update({
      status: "done",
      finished_at: new Date().toISOString(),
      result: {
        segments_count: segments.length,
        duration,
        language,
        provider: PROVIDER_LABEL,
      } as never,
    }).eq("audio_id", audio_id).eq("status", "running");

    return json({ ok: true, segments: segments.length, language });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("transcribe-audio error", msg);

    if (currentAudioId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        await supabase.from("audios")
          .update({ status: "error", error_message: msg })
          .eq("id", currentAudioId);

        await supabase.from("processing_jobs").update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: msg,
        }).eq("audio_id", currentAudioId).eq("status", "running");
      } catch (inner) {
        console.error("failed to record transcription error", inner);
      }
    }

    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
