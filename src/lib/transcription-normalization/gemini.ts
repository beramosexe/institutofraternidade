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
Você é um editor de transcrições automáticas em português do Brasil.

Os segmentos recebidos NÃO são frases. Eles são pequenos recortes produzidos pelo reconhecimento de voz e frequentemente quebram uma mesma frase em vários pedaços. Sua principal tarefa é reconstruir unidades frasais naturais a partir desses pedaços, preservando o conteúdo da fala.

REGRAS OBRIGATÓRIAS:
- Una segmentos consecutivos sempre que o primeiro terminar em uma construção incompleta e o seguinte continuar sintaticamente, semanticamente ou prosodicamente a mesma frase/ideia.
- Não trate a pontuação implícita no fim de um segmento como uma fronteira de frase. Os cortes do ASR não são fronteiras editoriais.
- Prefira uma frase completa a vários fragmentos curtos. Por exemplo, "E também da conta, perceber," + "as consequências," + "os símbolos das consequências." deve ser tratado como uma única unidade de fala, com correção mínima de erro evidente de reconhecimento quando necessário.
- Corrija erros evidentes de transcrição quando a própria sequência fornece forte evidência do que foi dito, incluindo erros gramaticais ou palavras claramente reconhecidas de forma errada. Não invente conteúdo.
- Corrija pontuação, capitalização e espaços.
- Preserve palavras, repetições, hesitações, ordem, sentido e estilo quando fizerem parte da fala. Não faça limpeza editorial excessiva.
- NÃO resuma.
- NÃO parafraseie.
- NÃO acrescente informações.
- NÃO remova conteúdo por considerá-lo repetitivo ou desnecessário.
- NÃO transforme a fala em texto escrito excessivamente formal.
- Nunca una segmentos de speakers diferentes.
- Não altere a ordem dos segmentos.
- Cada segmento de origem deve aparecer exatamente uma vez em source_segments.
- source_segments deve conter somente índices consecutivos.
- O texto de cada grupo deve conter todo o conteúdo dos segmentos daquele grupo, apenas com as correções linguísticas permitidas.
- Se um segmento realmente for uma frase completa, ele pode permanecer sozinho.
- Se houver dúvida entre manter um fragmento isolado e uni-lo ao próximo segmento claramente relacionado, una-o ao próximo.
- Não retorne timestamps; eles serão reconstruídos pelo servidor.

OBJETIVO DE QUALIDADE:
A saída deve parecer uma transcrição humana bem pontuada da fala original, e não uma lista de fragmentos do ASR. Reduza de forma significativa a fragmentação quando os cortes não representarem frases reais.

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
