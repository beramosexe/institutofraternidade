import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = [
  "Você recebe a transcrição de um áudio gravado em trabalhos de um instituto espiritualista.",
  "Sua tarefa é produzir uma síntese descritiva e fiel do que foi efetivamente falado.",
  "Regras obrigatórias:",
  "- Não interprete a mensagem, não julgue e não atribua significados que não estejam no conteúdo.",
  "- Não invente informações e não complete lacunas.",
  "- Não tente identificar ou inferir a entidade, o mentor ou quem falou.",
  "- Escreva em português do Brasil, em tom neutro e descritivo.",
  "Responda SOMENTE com um JSON no formato:",
  '{"summary":"texto de 3 a 6 frases","topics":"assuntos principais em uma frase","keywords":["palavra1","palavra2"]}',
  "As palavras-chave devem ser de 4 a 10 termos curtos referentes aos assuntos realmente abordados.",
].join("\n");

type Insights = { summary: string; keywords: string[] };

async function askGateway(text: string): Promise<Insights> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA não está configurada neste projeto.");

  const clipped = text.length > 60_000 ? `${text.slice(0, 60_000)}…` : text;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: clipped },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para gerar o resumo.");
    if (resp.status === 403) throw new Error("O uso de IA está bloqueado nas configurações do espaço de trabalho.");
    if (resp.status === 429) throw new Error("Muitas solicitações de IA agora. Tente novamente em alguns instantes.");
    throw new Error(`Falha ao gerar o resumo (${resp.status}). ${body.slice(0, 200)}`);
  }

  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  let parsed: { summary?: string; topics?: string; keywords?: unknown };
  try {
    parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    throw new Error("A IA respondeu em formato inesperado. Tente novamente.");
  }

  const summaryParts = [parsed.summary?.trim(), parsed.topics?.trim() ? `Assuntos: ${parsed.topics.trim()}` : ""]
    .filter(Boolean);
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
    : [];

  if (!summaryParts.length) throw new Error("A IA não retornou um resumo.");
  return { summary: summaryParts.join("\n\n"), keywords };
}

/** Gera (ou regera) resumo e palavras-chave de um áudio a partir da transcrição. */
export const generateAudioInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audio_id: string; force?: boolean }) =>
    z.object({ audio_id: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // RLS garante que só quem pode ver o áudio consegue lê-lo aqui.
    const { data: audio, error } = await supabase
      .from("audios")
      .select("id, summary, uploaded_by, audio_transcriptions(text)")
      .eq("id", data.audio_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!audio) throw new Error("Áudio não encontrado ou sem acesso.");

    if (audio.summary && !data.force) return { skipped: true as const, summary: audio.summary };

    if (data.force) {
      const { data: canEdit } = await supabase.rpc("has_permission", {
        _user_id: userId,
        _permission: "audio.edit_any",
      });
      const { data: canReview } = await supabase.rpc("has_permission", {
        _user_id: userId,
        _permission: "transcription.review",
      });
      if (!canEdit && !canReview && audio.uploaded_by !== userId) {
        throw new Error("Você não tem permissão para gerar o resumo deste áudio.");
      }
    }

    const t = Array.isArray(audio.audio_transcriptions)
      ? audio.audio_transcriptions[0]
      : audio.audio_transcriptions;
    const text = (t as { text?: string } | null)?.text?.trim();
    if (!text || text.length < 40) throw new Error("Transcrição ainda não disponível para gerar o resumo.");

    const insights = await askGateway(text);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("audios")
      .update({ summary: insights.summary, keywords: insights.keywords })
      .eq("id", data.audio_id);
    if (upErr) throw new Error(upErr.message);

    return { skipped: false as const, ...insights };
  });

/** Permite ao revisor ajustar manualmente resumo e palavras-chave. */
export const saveAudioInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audio_id: string; summary: string | null; keywords: string[] }) =>
    z.object({
      audio_id: z.string().uuid(),
      summary: z.string().max(6000).nullable(),
      keywords: z.array(z.string().min(1).max(60)).max(20),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("audios")
      .update({ summary: data.summary, keywords: data.keywords })
      .eq("id", data.audio_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
