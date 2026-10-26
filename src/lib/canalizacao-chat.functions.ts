import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function askGemini(question: string, transcript: string, title: string, history: ChatMessage[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA não está configurada neste projeto.");

  const clippedTranscript = transcript.length > 45_000 ? transcript.slice(0, 45_000) + "…" : transcript;
  const system = [
    "Você é um assistente do Instituto Fraternidade, em português do Brasil.",
    "Ajude a pessoa a compreender e trabalhar com a canalização fornecida como contexto.",
    "Responda dúvidas sobre o conteúdo, organize reflexões, resuma ideias e crie conteúdos solicitados (textos, legendas, roteiros ou perguntas) relacionados à mensagem.",
    "Diferencie claramente o que está explicitamente na transcrição de qualquer interpretação ou sugestão sua.",
    "Não invente trechos da canalização, não afirme saber a identidade de entidades ou autores e não apresente interpretações espirituais como fatos comprovados.",
    "Se a transcrição não sustentar uma resposta, diga isso com clareza. Seja acolhedor, respeitoso e direto.",
    "Título da canalização: " + title,
    "Transcrição/contexto da canalização:\n" + clippedTranscript,
  ].join("\n\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: system },
        ...history.slice(-10).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
    if (response.status === 403) throw new Error("O uso de IA está bloqueado nas configurações do projeto.");
    if (response.status === 429) throw new Error("Muitas solicitações agora. Tente novamente em instantes.");
    throw new Error(`Falha ao consultar o Gemini (${response.status}).`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("A IA não retornou uma resposta.");
  return answer;
}

/** Responde usando a transcrição do áudio que o usuário tem permissão para acessar. */
export const askCanalizacaoAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audio_id: string; question: string; history?: ChatMessage[] }) =>
    z.object({
      audio_id: z.string().uuid(),
      question: z.string().trim().min(1).max(4000),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })).max(10).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: audio, error } = await context.supabase
      .from("audios")
      .select("id, title, audio_type, status, audio_transcriptions(text, raw_text, normalized_text)")
      .eq("id", data.audio_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!audio) throw new Error("Canalização não encontrada ou você não tem acesso.");
    if (audio.audio_type !== "canalizacao") throw new Error("O chat está disponível apenas para canalizações.");
    if (audio.status !== "ready") throw new Error("Aguarde a conclusão do processamento da canalização.");

    const transcription = Array.isArray(audio.audio_transcriptions)
      ? audio.audio_transcriptions[0]
      : audio.audio_transcriptions;
    const t = transcription as { normalized_text?: string | null; raw_text?: string | null; text?: string | null } | null;
    const transcript = (t?.normalized_text ?? t?.raw_text ?? t?.text ?? "").trim();
    if (transcript.length < 20) throw new Error("Esta canalização ainda não tem uma transcrição suficiente para conversar.");

    const answer = await askGemini(data.question, transcript, audio.title, data.history ?? []);
    return { answer };
  });
