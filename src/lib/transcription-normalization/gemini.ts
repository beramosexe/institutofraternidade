import type { NormalizationGroup, RawTranscriptSegment } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const CHUNK_SIZE = 80;
const CHUNK_OVERLAP = 8;
const MAX_BOUNDARY_RETRIES = 1;

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

OBJETIVO: reconstruir sentenças e orações completas, com pontuação natural, sem transformar a fala em resumo ou paráfrase.

REGRAS DE CONTEÚDO:
- Una segmentos consecutivos que formem uma mesma frase, inclusive quando cada recorte isolado parece gramaticalmente plausível.
- Não trate timestamps, pausas curtas ou limites técnicos de blocos como fronteira editorial.
- Não deixe artigos, preposições, conectivos, pronomes ou complementos isolados.
- Só encerre um grupo quando a construção estiver completa ou houver mudança real de falante.
- Preserve a sequência, palavras, repetições, hesitações e oralidade.
- Corrija apenas pontuação, capitalização e erros evidentes de ASR sustentados pelo contexto.
- Não resuma, parafraseie, invente nem elimine conteúdo.
- Nunca una falantes diferentes.

REGRAS DE RASTREABILIDADE:
- source_segments deve conter índices globais, inteiros, consecutivos e crescentes.
- Cada índice solicitado deve aparecer exatamente uma vez na resposta.
- Cada texto de grupo deve corresponder ao conteúdo dos índices daquele grupo.
- Não inclua no texto de um grupo conteúdo pertencente a índices de outro grupo.
- A saída deve cobrir integralmente os índices apresentados.

BORDAS ENTRE BLOCOS:
- Os dados podem incluir uma região identificada como CONTEXTO. Ela serve para compreender a frase, mas não pertence à saída deste bloco.
- Não retorne índices da região CONTEXTO.
- Se a primeira unidade de saída for continuação de uma frase que começou no contexto, retorne somente o texto correspondente aos índices deste bloco e não repita o texto anterior.
- Não force ponto final quando a frase claramente continuar depois do bloco.

Exemplos:
- "Abençoar" + "a própria vida." => "Abençoar a própria vida."
- "É importante que vocês" + "compreendam esse processo." => uma sentença, não dois grupos.
- Um novo falante sempre inicia outro grupo.

${forceGrouping ? "- MODO DE RECUPERAÇÃO: una fragmentos curtos contíguos quando houver continuidade sintática ou semântica clara. Ainda assim, não una sentenças independentes completas." : ""}
Retorne SOMENTE JSON conforme o schema.
`;
}

async function requestGemini(
  input: Array<Record<string, unknown>>,
  forceGrouping: boolean,
): Promise<NormalizationGroup[]> {
  const { apiKey, model } = getGeminiConfig();
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
            text:
              "Reconstrua as frases, agrupando por unidade frasal. Os registros CONTEXTO são apenas referência. Os registros SAÍDA devem ser cobertos exatamente uma vez.\\n\\n" +
              JSON.stringify(input),
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

function validateChunkGroups(
  groups: NormalizationGroup[],
  expectedIndices: number[],
  allowedSpeakers: Map<number, number | undefined>,
) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("A IA não retornou grupos para o bloco.");
  }
  const actual = groups.flatMap((group) => {
    if (!Array.isArray(group.source_segments) || !group.source_segments.length) {
      throw new Error("A IA retornou um grupo sem segmentos de origem.");
    }
    if (typeof group.text !== "string" || !group.text.trim()) {
      throw new Error("A IA retornou um grupo sem texto.");
    }
    for (const index of group.source_segments) {
      if (!Number.isInteger(index) || !allowedSpeakers.has(index)) {
        throw new Error(`A IA retornou índice fora do bloco: ${index}.`);
      }
    }
    for (let i = 1; i < group.source_segments.length; i += 1) {
      if (group.source_segments[i] !== group.source_segments[i - 1] + 1) {
        throw new Error("Um grupo do Gemini contém índices não consecutivos.");
      }
    }
    for (let i = 1; i < group.source_segments.length; i += 1) {
      const previousSpeaker = allowedSpeakers.get(group.source_segments[i - 1]);
      const currentSpeaker = allowedSpeakers.get(group.source_segments[i]);
      if (previousSpeaker !== undefined && currentSpeaker !== undefined && previousSpeaker !== currentSpeaker) {
        throw new Error("A IA tentou unir segmentos de falantes diferentes.");
      }
    }
    return group.source_segments;
  });
  if (actual.length !== expectedIndices.length || actual.some((index, i) => index !== expectedIndices[i])) {
    throw new Error("A resposta do Gemini não cobriu exatamente os índices solicitados em ordem.");
  }
}

function makeInput(
  segments: RawTranscriptSegment[],
  start: number,
  end: number,
  previousContextStart: number,
  forceGrouping: boolean,
) {
  const records: Array<Record<string, unknown>> = [];
  for (let index = previousContextStart; index < start; index += 1) {
    const segment = segments[index];
    records.push({
      region: "CONTEXTO",
      index,
      ...(typeof segment.speaker === "number" ? { speaker: segment.speaker } : {}),
      text: segment.text.trim(),
    });
  }
  for (let index = start; index < end; index += 1) {
    const segment = segments[index];
    records.push({
      region: "SAÍDA",
      index,
      ...(typeof segment.speaker === "number" ? { speaker: segment.speaker } : {}),
      text: segment.text.trim(),
    });
  }
  return records;
}

/**
 * Normalizes bounded chunks while treating overlap strictly as read-only context.
 * Each request owns a non-overlapping output range. Context is never re-emitted,
 * so sentence text and source indices cannot be duplicated at chunk boundaries.
 */
export async function normalizeWithGemini(
  segments: RawTranscriptSegment[],
  options: { forceGrouping?: boolean } = {},
): Promise<NormalizationGroup[]> {
  if (segments.length === 0) return [];

  const allGroups: NormalizationGroup[] = [];
  let start = 0;

  while (start < segments.length) {
    const end = Math.min(segments.length, start + CHUNK_SIZE);
    const contextStart = Math.max(0, start - CHUNK_OVERLAP);
    const outputIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const allowedSpeakers = new Map<number, number | undefined>();
    for (let index = contextStart; index < end; index += 1) {
      allowedSpeakers.set(index, segments[index].speaker);
    }

    const input = makeInput(
      segments,
      start,
      end,
      contextStart,
      options.forceGrouping ?? false,
    );
    let chunkGroups: NormalizationGroup[] | null = null;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_BOUNDARY_RETRIES; attempt += 1) {
      try {
        chunkGroups = await requestGemini(input, (options.forceGrouping ?? false) || attempt > 0);
        validateChunkGroups(chunkGroups, outputIndices, allowedSpeakers);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!chunkGroups || lastError) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Não foi possível reconstruir o bloco da transcrição.");
    }

    allGroups.push(...chunkGroups.map((group) => ({
      source_segments: [...group.source_segments],
      text: group.text.trim(),
    })));

    start = end;
  }

  const flattened = allGroups.flatMap((group) => group.source_segments);
  const expected = segments.map((_, index) => index);
  if (flattened.length !== expected.length || flattened.some((index, i) => index !== expected[i])) {
    throw new Error("A normalização em blocos não preservou a sequência completa dos segmentos.");
  }

  return allGroups;
}
