import type {
  NormalizationGroup,
  NormalizedTranscriptSegment,
  RawTranscriptSegment,
} from "./types";

function sameSpeaker(a: RawTranscriptSegment, b: RawTranscriptSegment) {
  return a.speaker === undefined || b.speaker === undefined || a.speaker === b.speaker;
}

export function validateNormalizationGroups(
  groups: NormalizationGroup[],
  source: RawTranscriptSegment[],
): NormalizedTranscriptSegment[] {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("A IA não retornou grupos de normalização.");
  }

  const normalized: NormalizedTranscriptSegment[] = [];
  let expectedIndex = 0;

  for (const group of groups) {
    if (!Array.isArray(group.source_segments) || group.source_segments.length === 0) {
      throw new Error("A IA retornou um grupo sem segmentos de origem.");
    }

    if (typeof group.text !== "string" || !group.text.trim()) {
      throw new Error("A IA retornou um grupo sem texto.");
    }

    for (let i = 0; i < group.source_segments.length; i += 1) {
      const index = group.source_segments[i];

      if (!Number.isInteger(index) || index < 0 || index >= source.length) {
        throw new Error(`Índice de segmento inválido na normalização: ${index}.`);
      }

      if (index !== expectedIndex) {
        throw new Error(
          `A normalização não cobriu os segmentos em ordem. Esperado ${expectedIndex}, recebido ${index}.`,
        );
      }

      if (i > 0 && !sameSpeaker(source[index - 1], source[index])) {
        throw new Error("A normalização tentou unir segmentos de pessoas diferentes.");
      }

      expectedIndex += 1;
    }

    const first = source[group.source_segments[0]];
    const last = source[group.source_segments[group.source_segments.length - 1]];

    normalized.push({
      start: first.start,
      end: last.end,
      text: group.text.trim(),
      ...(typeof first.speaker === "number" ? { speaker: first.speaker } : {}),
    });
  }

  if (expectedIndex !== source.length) {
    throw new Error(
      `A normalização não cobriu toda a transcrição: ${expectedIndex} de ${source.length} segmentos.`,
    );
  }

  return normalized;
}
