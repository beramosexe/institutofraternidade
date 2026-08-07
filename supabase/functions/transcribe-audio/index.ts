// Edge function: transcribes an audio using Lovable AI Speech-to-Text.
// Triggered after upload from src/lib/audios.functions.ts -> registerAudio
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body { audio_id: string }

interface Segment { start: number; end: number; text: string }

const TRANSCRIPTION_MODEL = "openai/gpt-4o-mini-transcribe";
const PROVIDER_LABEL = `lovable-ai:${TRANSCRIPTION_MODEL}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio_id } = (await req.json()) as Body;
    if (!audio_id) return json({ error: "audio_id required" }, 400);

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
      status: "error", error_message: "Execução anterior interrompida.",
      finished_at: new Date().toISOString(),
    }).eq("audio_id", audio_id).eq("status", "running");

    await supabase.from("audios").update({ status: "transcribing", error_message: null }).eq("id", audio_id);
    await supabase.from("processing_jobs").update({
      status: "done", finished_at: new Date().toISOString(),
    }).eq("audio_id", audio_id).eq("status", "pending");
    await supabase.from("processing_jobs").insert({
      audio_id, job_type: "transcribe", status: "running", started_at: new Date().toISOString(),
    });

    // Download audio file from storage
    const { data: blob, error: dErr } = await supabase.storage.from("audios").download(audio.storage_path);
    if (dErr || !blob) throw new Error("Failed to download audio: " + (dErr?.message ?? "no blob"));

    const arrayBuffer = await blob.arrayBuffer();
    const mime = audio.mime_type || blob.type || "audio/mpeg";
    const extension = mimeToExtension(mime);

    // Build multipart form data for STT endpoint
    const form = new FormData();
    form.append("model", TRANSCRIPTION_MODEL);
    form.append("language", "pt");
    form.append("response_format", "json");
    form.append("file", new Blob([arrayBuffer], { type: mime }), `audio.${extension}`);

    // Call Lovable AI Gateway (OpenAI-compatible audio transcriptions)
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    console.log(`Transcribing ${audio_id} (${(arrayBuffer.byteLength / 1e6).toFixed(2)} MB, ${mime})`);

    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: form,
        // Hard limit so the function never dies silently waiting on the provider.
        signal: AbortSignal.timeout(4 * 60 * 1000),
      });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "TimeoutError";
      throw new Error(
        aborted
          ? "A transcrição excedeu o tempo limite de 4 minutos. Tente novamente ou envie um arquivo menor."
          : `Falha de rede ao chamar o serviço de transcrição: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) throw new Error("Limite de uso do serviço de transcrição atingido. Tente novamente em alguns minutos.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para transcrever novos áudios.");
      throw new Error(`Gateway ${resp.status}: ${t.slice(0, 500)}`);
    }


    const ai = await resp.json();
    console.log("STT response keys:", Object.keys(ai));
    console.log("STT response sample:", JSON.stringify(ai).slice(0, 1000));
    const rawSegments = ai.segments;
    const segments: Segment[] = Array.isArray(rawSegments)
      ? rawSegments.map((s: { start: number; end: number; text: string }) => ({
          start: Number(s.start),
          end: Number(s.end),
          text: String(s.text).trim(),
        })).filter((s) => s.text.length > 0)
      : [];

    const text = ai.text || segments.map((s) => s.text).join(" ").trim();

    if (!text) {
      throw new Error("Transcription returned empty text");
    }

    // Upsert transcription
    const { data: existing } = await supabase
      .from("audio_transcriptions").select("id").eq("audio_id", audio_id).maybeSingle();

    if (existing) {
      await supabase.from("audio_transcriptions").update({
        text, segments: segments as never, language: ai.language ?? "pt",
        provider: PROVIDER_LABEL, review_status: "unreviewed",
      }).eq("id", existing.id);
    } else {
      await supabase.from("audio_transcriptions").insert({
        audio_id, text, segments: segments as never, language: ai.language ?? "pt",
        provider: PROVIDER_LABEL,
      });
    }

    await supabase.from("audios").update({ status: "ready", error_message: null }).eq("id", audio_id);
    await supabase.from("processing_jobs").update({
      status: "done", finished_at: new Date().toISOString(),
      result: { segments_count: segments.length, duration: ai.duration, language: ai.language } as never,
    }).eq("audio_id", audio_id).eq("status", "running");

    return json({ ok: true, segments: segments.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("transcribe-audio error", msg);
    try {
      const { audio_id } = (await req.clone().json()) as Body;
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("audios").update({ status: "error", error_message: msg }).eq("id", audio_id);
      await supabase.from("processing_jobs").update({
        status: "error", finished_at: new Date().toISOString(), error_message: msg,
      }).eq("audio_id", audio_id).eq("status", "running");
    } catch (_) { /* ignore */ }
    return json({ error: msg }, 500);
  }
});

function mimeToExtension(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp3")) return "mp3";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  return "mp3";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
