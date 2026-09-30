import type { NormalizationGroup, RawTranscriptSegment } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      source_segments: {
        type: "ARRAY",
        items: { type: "INTEGER" },
      },
      text: {
        type: "STRING",
      },
    },
    required: ["source_segments", "text"],
  },
};

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não está configurada no ambiente do servidor.");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

export async function normalizeWithGemini(
  segments: RawTranscriptSegment[],
): Promise<NormalizationGroup[]> {
  const { apiKey, model } = getGeminiConfig();

  const input = segments.map((segment, index) => ({
    index,
    start: segment.start,
    end: segment.end,
    ...(typeof segment.speaker === "number" ? { speaker: segment.speaker } : {}),
    text: segment.text,
  }));

  const systemInstruction = `
Você é um normalizador de transcrições em português do Brasil.

Sua tarefa é NORMALIZAR uma transcrição automática, não reescrevê-la.

REGRAS OBRIGATÓRIAS:
- Preserve integralmente o conteúdo, a ordem, o sentido e o estilo da fala.
- Faça apenas correções linguísticas mínimas e óbvias: pontuação, capitalização, espaços e erros claros de transcrição.
- Você pode UNIR segmentos consecutivos quando eles formarem uma mesma frase, ideia ou unidade de fala.
- Nunca una segmentos de speakers diferentes.
- Não resuma.
- Não parafraseie.
- Não elimine repetições, hesitações ou trechos por serem pouco importantes.
- Não acrescente informações.
- Não invente palavras que não estejam sustentadas pela transcrição.
- Não altere timestamps: você não deve retornar timestamps.
- Não altere a ordem dos segmentos.
- Cada segmento de origem deve aparecer exatamente uma vez em source_segments.
- source_segments deve conter apenas índices consecutivos.
- O texto de cada grupo deve representar todos os segmentos daquele grupo.
- Se um segmento já estiver adequado sozinho, mantenha-o sozinho.
- Prefira mudanças conservadoras. Em caso de dúvida, preserve o texto original.

Retorne SOMENTE o JSON solicitado pelo schema.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Normalize os segmentos abaixo. Preserve todo o conteúdo e agrupe somente segmentos consecutivos quando isso melhorar a unidade frasal.\\n\\n" +
                  JSON.stringify(input),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Gemini retornou HTTP ${response.status}.`,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini não retornou conteúdo para a normalização.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini retornou um JSON inválido para a normalização.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini não retornou uma lista de grupos.");
  }

  return parsed as NormalizationGroup[];
}
