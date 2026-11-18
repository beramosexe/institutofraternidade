import type { NormalizationGroup, RawTranscriptSegment } from "./types";

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      source_segments: { type: "ARRAY", items: { type: "INTEGER" } },
      text: { type: "STRING" },
    },
    required: ["source_segments", "text"],
  },
};

/**
 * Independent editorial pass. It receives both the original ASR segments and
 * the first normalization result, then repairs sentence boundaries, grammar
 * and punctuation without summarizing or removing spoken content.
 */
export async function checkAndImproveNormalization(
  source: RawTranscriptSegment[],
  draft: NormalizationGroup[],
): Promise<NormalizationGroup[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada no ambiente do servidor.");
  const model = process.env.GEMINI_NORMALIZATION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const original = source.map((segment, index) => ({
    index,
    speaker: segment.speaker ?? null,
    text: segment.text,
  }));

  const reviewInstruction = `
Você é um revisor editorial independente de transcrições em português brasileiro.
Você receberá os segmentos originais do reconhecimento de voz e uma primeira versão normalizada.

Sua tarefa é CHECAR E CORRIGIR a primeira versão antes que ela seja publicada:
- Reconstrua frases completas quando ainda houver fragmentos curtos que claramente pertencem à mesma frase.
- Corrija concordância, regência, pontuação, capitalização e erros evidentes de reconhecimento, somente quando houver evidência no áudio representada pelo contexto textual.
- Garanta que cada grupo seja uma unidade de sentido legível. Não deixe conectivos, artigos, preposições ou complementos soltos em grupos separados quando pertencem à frase seguinte/anterior.
- Preserve o conteúdo efetivamente falado, a ordem, repetições relevantes, hesitações e oralidade.
- Não resuma, não parafraseie, não invente, não formalize excessivamente e não elimine conteúdo.
- Nunca una falas de pessoas diferentes.
- Cada índice original deve aparecer exatamente uma vez, em ordem, em source_segments.
- Cada grupo deve conter índices consecutivos.
- A saída deve corrigir a transcrição, não apenas avaliar ou comentar.
- Retorne somente a lista JSON no schema solicitado.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: reviewInstruction }] },
        contents: [{
          role: "user",
          parts: [{
            text: "Revise a normalização. Compare com os segmentos originais e devolva a versão final corrigida.\\n\\nORIGINAL:\\n" +
              JSON.stringify(original) +
              "\\n\\nPRIMEIRA NORMALIZAÇÃO:\\n" +
              JSON.stringify(draft),
          }],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  const payload = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini quality check retornou HTTP ${response.status}.`);
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini não retornou conteúdo na checagem de qualidade.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini retornou JSON inválido na checagem de qualidade.");
  }
  if (!Array.isArray(parsed)) throw new Error("A checagem de qualidade não retornou uma lista de grupos.");
  return parsed as NormalizationGroup[];
}
