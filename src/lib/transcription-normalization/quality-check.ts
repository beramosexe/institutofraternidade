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
  const speakerByIndex = new Map(original.map((segment) => [segment.index, segment.speaker]));

  const reviewInstruction = `
Você é um revisor editorial que deve entregar a transcrição final em português brasileiro.
O primeiro passe pode ter deixado os cortes do reconhecimento de voz como se fossem frases. Corrija isso.
- A unidade de saída é uma frase ou oração completa, não um segmento de ASR.
- Una frases fragmentadas em vários itens quando forem continuação sintática ou semântica.
- "Abençoar" seguido de "a própria vida." deve resultar em "Abençoar a própria vida."
- Conectivos, artigos, preposições e complementos não devem ficar isolados.
- Não use timestamps nem pausas curtas como fronteira editorial.
- Não mantenha grupos unitários ou de poucas palavras apenas para preservar o formato anterior.
- Preserve cada palavra e a sequência falada; não resuma, não invente, não parafraseie e não apague repetições relevantes.
- Corrija apenas pontuação, capitalização, gramática e erros evidentes de ASR sustentados pelo contexto.
- Não una falas de pessoas diferentes.
- Cada índice original deve aparecer uma única vez, em ordem, em índices consecutivos.
- Não una segmentos de falantes diferentes; respeite o campo speaker dos índices originais.
- A propriedade text deve conter o texto completo e legível correspondente a todos os índices do grupo.
- Não copie conteúdo de um grupo para outro, nem repita palavras apenas para produzir uma frase mais longa.
- Retorne somente JSON no schema solicitado.
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
            text: "ORIGINAIS (referência obrigatória):\\n" +
              JSON.stringify(original) +
              "\\n\\nRASCUNHO (pode estar fragmentado; reestruture as frases):\\n" +
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
  try { parsed = JSON.parse(text); }
  catch { throw new Error("Gemini retornou JSON inválido na checagem de qualidade."); }
  if (!Array.isArray(parsed)) throw new Error("A checagem de qualidade não retornou uma lista de grupos.");

  const groups = parsed as NormalizationGroup[];
  const actual = groups.flatMap((group) => {
    if (!Array.isArray(group.source_segments) || group.source_segments.length === 0) {
      throw new Error("A revisão editorial retornou um grupo sem segmentos de origem.");
    }
    if (typeof group.text !== "string" || !group.text.trim()) {
      throw new Error("A revisão editorial retornou um grupo sem texto.");
    }
    for (let i = 0; i < group.source_segments.length; i += 1) {
      const index = group.source_segments[i];
      if (!Number.isInteger(index) || index < 0 || index >= source.length) {
        throw new Error(`Índice original inválido na revisão editorial: ${index}.`);
      }
      if (i > 0 && index !== group.source_segments[i - 1] + 1) {
        throw new Error("A revisão editorial retornou índices não consecutivos.");
      }
      if (i > 0) {
        const previousSpeaker = speakerByIndex.get(index - 1);
        const currentSpeaker = speakerByIndex.get(index);
        if (previousSpeaker !== null && currentSpeaker !== null && previousSpeaker !== currentSpeaker) {
          throw new Error("A revisão editorial tentou unir falas de pessoas diferentes.");
        }
      }
    }
    return group.source_segments;
  });
  const expected = source.map((_, index) => index);
  if (actual.length !== expected.length || actual.some((index, i) => index !== expected[i])) {
    throw new Error("A revisão editorial não preservou integralmente a ordem e a cobertura dos segmentos originais.");
  }
  return groups;
}
