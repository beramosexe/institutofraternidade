import type { NormalizationGroup, RawTranscriptSegment } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const CHUNK_SIZE = 80;

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

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada no ambiente do servidor.");
  return {
    apiKey,
    model: process.env.GEMINI_NORMALIZATION_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

function makeSystemInstruction(forceGrouping: boolean) {
  return `
Você é um editor de transcrições automáticas em português do Brasil.
Os itens enviados são recortes de ASR, NÃO frases. O índice identifica o segmento original.

OBJETIVO PRINCIPAL: reconstruir frases completas e unidades de sentido naturais. A quantidade de grupos deve ser significativamente menor que a quantidade de segmentos RAW quando os cortes forem artificiais.

REGRAS:
- Una segmentos consecutivos que façam parte da mesma frase/oração, inclusive quando cada pedaço isolado parece gramaticalmente plausível.
- Não trate mudança de timestamp nem pausa curta como fim de frase.
- Um grupo pode conter vários segmentos; a fronteira deve representar uma conclusão real de frase/ideia, não cada pequeno corte do ASR.
- Não deixe artigos, preposições, conectivos, pronomes ou complementos isolados.
- Só encerre um grupo quando a frase estiver sintática e semanticamente completa, ou houver mudança clara de falante/assunto e a construção anterior estiver completa.
- Preserve ordem, palavras, repetições, hesitações e oralidade. Corrija pontuação, capitalização e erros evidentes de ASR com forte evidência contextual.
- Não resuma, parafraseie, invente nem elimine conteúdo.
- Nunca una falantes diferentes.
- source_segments deve conter índices consecutivos; todos os índices devem aparecer exatamente uma vez e em ordem.
- text deve conter o conteúdo correspondente ao grupo, com pontuação humana. Não copie literalmente um fragmento curto apenas porque veio separado.
- Exemplos: "Abençoar" + "a própria vida." deve virar um grupo "Abençoar a própria vida."; "Quem é merecedor" + "de abençoar," + "de bênçãos?" só deve ser dividido se a fala realmente apresentar uma pausa/ideia concluída; neste contexto, reconstrua uma frase coerente.
- Se o item termina com artigo, preposição, conjunção, pronome relativo ou verbo que exige complemento, una ao seguinte.
- Se um item seguinte completa semanticamente o anterior, una-os mesmo que o anterior termine com pontuação espúria.
${forceGrouping ? "- MODO DE RECUPERAÇÃO: a versão anterior permaneceu excessivamente fragmentada. Seja mais agressivo ao unir segmentos curtos contíguos. Não gere grupos de uma única palavra ou de 2-4 palavras, a menos que sejam uma resposta/expressão realmente completa e independente." : ""}
Retorne SOMENTE JSON conforme o schema.
`;
}

async function normalizeChunk(
  segments: RawTranscriptSegment[],
  offset: number,
  forceGrouping: boolean,
): Promise<NormalizationGroup[]> {
  const { apiKey, model } = getGeminiConfig();
  const input = segments.map((segment, localIndex) => ({
    index: offset + localIndex,
    start: segment.start,
    end: segment.end,
    ...(typeof segment.speaker === "number" ? { speaker: segment.speaker } : {}),
    text: segment.text.trim(),
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: makeSystemInstruction(forceGrouping) }] },
        contents: [{
          role: "user",
          parts: [{
            text: "Reconstrua as frases. Agrupe por unidade frasal, não por recorte ASR. Índices globais:\\n\\n" + JSON.stringify(input),
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
    throw new Error(payload.error?.message || `Gemini retornou HTTP ${response.status}.`);
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini não retornou conteúdo para a normalização.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("Gemini retornou um JSON inválido para a normalização."); }
  if (!Array.isArray(parsed)) throw new Error("Gemini não retornou uma lista de grupos.");
  return parsed as NormalizationGroup[];
}

/** Normalize in bounded chunks, preserving global source indices. */
export async function normalizeWithGemini(
  segments: RawTranscriptSegment[],
  options: { forceGrouping?: boolean } = {},
): Promise<NormalizationGroup[]> {
  const groups: NormalizationGroup[] = [];
  for (let start = 0; start < segments.length; start += CHUNK_SIZE) {
    const chunk = segments.slice(start, start + CHUNK_SIZE);
    const chunkGroups = await normalizeChunk(chunk, start, options.forceGrouping ?? false);
    groups.push(...chunkGroups);
  }
  return groups;
}
