// Edge function: transcribes an audio using Lovable AI (Gemini 2.5 Flash with audio input).
// Triggered after upload from src/lib/audios.functions.ts → registerAudio
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body { audio_id: string }

interface Segment { start: number; end: number; text: string }

const SYSTEM_PROMPT = `Você é um transcritor profissional de áudio em português brasileiro.
Transcreva o áudio fielmente, mantendo a pontuação natural.
Segmente em frases curtas (geralmente entre 5 e 25 palavras), com timestamps precisos.
Responda SOMENTE com JSON válido no formato:
{"language":"pt","segments":[{"start":0.0,"end":3.2,"text":"..."}, ...]}
Sem comentários, sem markdown.`;

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

    // Mark job running
    await supabase.from("audios").update({ status: "transcribing" }).eq("id", audio_id);
    await supabase.from("processing_jobs").insert({
      audio_id, job_type: "transcribe", status: "running", started_at: new Date().toISOString(),
    });

    // Download audio file from storage
    const { data: blob, error: dErr } = await supabase.storage.from("audios").download(audio.storage_path);
    if (dErr || !blob) throw new Error("Failed to download audio: " + (dErr?.message ?? "no blob"));

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(arrayBuffer));
    const mime = audio.mime_type || blob.type || "audio/mpeg";

    // Call Lovable AI Gateway (OpenAI-compatible chat completions)
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva este áudio em pt-BR e retorne JSON conforme as instruções." },
              { type: "input_audio", input_audio: { data: base64, format: mime.includes("wav") ? "wav" : "mp3" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Gateway ${resp.status}: ${t.slice(0, 300)}`);
    }

    const ai = await resp.json();
    const content: string = ai.choices?.[0]?.message?.content ?? "{}";
    let parsed: { language?: string; segments?: Segment[]; text?: string } = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { segments: [] };
    }
    const segments: Segment[] = Array.isArray(parsed.segments) ? parsed.segments : [];
    const text = segments.map((s) => s.text).join(" ").trim() || parsed.text || "";

    // Upsert transcription
    const { data: existing } = await supabase
      .from("audio_transcriptions").select("id").eq("audio_id", audio_id).maybeSingle();

    if (existing) {
      await supabase.from("audio_transcriptions").update({
        text, segments: segments as never, language: parsed.language ?? "pt",
        provider: "lovable-ai:google/gemini-2.5-flash", review_status: "unreviewed",
      }).eq("id", existing.id);
    } else {
      await supabase.from("audio_transcriptions").insert({
        audio_id, text, segments: segments as never, language: parsed.language ?? "pt",
        provider: "lovable-ai:google/gemini-2.5-flash",
      });
    }

    await supabase.from("audios").update({ status: "ready", error_message: null }).eq("id", audio_id);
    await supabase.from("processing_jobs").update({
      status: "done", finished_at: new Date().toISOString(),
      result: { segments_count: segments.length } as never,
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
