import type {
  NormalizationGroup,
  NormalizedTranscriptSegment,
  RawTranscriptSegment,
} from "./types";

function sameSpeaker(a: RawTranscriptSegment, b: RawTranscriptSegment) {
  return a.speaker === undefined || b.speaker === undefined || a.speaker === b.speaker;
}

/** Validates full ordered coverage and reconstructs timestamps from the RAW source. */
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

/**
 * Structural quality gate. It does not mistake a technical coverage pass for
 * editorial quality: obvious continuation fragments and near-1:1 output fail.
 */
export function getFragmentationMetrics(
  normalized: NormalizedTranscriptSegment[],
  source: RawTranscriptSegment[],
) {
  const unfinished = normalized.filter((segment) => {
    const clean = segment.text.trim();
    const words = clean.split(/\s+/).filter(Boolean);
    const endsSentence = /[.!?…][”’"')\]]*$/.test(clean);
    const startsWithContinuation = /^(e|mas|porque|que|de|da|do|das|dos|para|por|com|em|no|na|nos|nas|a|o|as|os|um|uma|ao|à)\b/i.test(clean);
    return words.length <= 5 && !endsSentence && (startsWithContinuation || !/[.!?…]$/.test(clean));
  }).length;
  const tinyWithoutEnding = normalized.filter((segment) => {
    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    return words.length <= 3 && !/[.!?…][”’"')\]]*$/.test(segment.text.trim());
  }).length;
  const reduction = source.length ? 1 - normalized.length / source.length : 0;
  const suspiciousRatio = normalized.length ? unfinished / normalized.length : 0;
  const tinyRatio = normalized.length ? tinyWithoutEnding / normalized.length : 0;
  const enoughSource = source.length >= 12;
  const warning = enoughSource && (
    reduction < 0.25 ||
    suspiciousRatio > 0.2 ||
    tinyRatio > 0.12
  );

  return {
    rawSegments: source.length,
    finalGroups: normalized.length,
    groupingReductionPercent: Math.round(reduction * 100),
    averageSourceSegmentsPerGroup: normalized.length
      ? Number((source.length / normalized.length).toFixed(2))
      : 0,
    suspiciousFragments: unfinished,
    tinyUnfinishedGroups: tinyWithoutEnding,
    suspiciousRatio: Number(suspiciousRatio.toFixed(3)),
    qualityStatus: warning ? "warning" as const : "ok" as const,
  };
}

export function assertAcceptableGrouping(
  normalized: NormalizedTranscriptSegment[],
  source: RawTranscriptSegment[],
) {
  const metrics = getFragmentationMetrics(normalized, source);
  if (metrics.qualityStatus === "warning") {
    throw new Error(
      "A normalização ainda está fragmentada (redução de " +
      metrics.groupingReductionPercent +
      "%; " + metrics.suspiciousFragments +
      " grupos suspeitos). A transcrição não foi substituída. Tente normalizar novamente.",
    );
  }
  return metrics;
}


/**
 * Deterministic final pass: merge adjacent ASR fragments that clearly do not
 * form independent sentences. Gemini remains responsible for editorial
 * correction; this guard prevents obvious sentence splits from reaching UI.
 */
export function mergeObviousFragments(
  segments: NormalizedTranscriptSegment[],
): NormalizedTranscriptSegment[] {
  const result: NormalizedTranscriptSegment[] = [];
  const sentenceEnd = /[.!?…][”’"')\]]*$/;
  const continuationStart = /^(a|o|as|os|um|uma|uns|umas|de|da|do|das|dos|em|no|na|nos|nas|ao|à|para|por|com|que|se|e|mas|porque|como|quando|onde|meu|minha|seu|sua|isso|essa|esse|este|esta)\b/i;

  for (const current of segments) {
    const previous = result[result.length - 1];
    if (!previous) {
      result.push({ ...current });
      continue;
    }

    const sameSpeaker =
      previous.speaker === undefined ||
      current.speaker === undefined ||
      previous.speaker === current.speaker;
    const previousText = previous.text.trim();
    const currentText = current.text.trim();
    const previousIsOpen = !sentenceEnd.test(previousText);
    const currentStartsAsContinuation = continuationStart.test(currentText);
    const shouldMerge = sameSpeaker && (previousIsOpen || currentStartsAsContinuation);

    if (shouldMerge) {
      previous.text = `${previousText.replace(/[\s,;:]+$/, "")} ${currentText}`.trim();
      previous.end = current.end;
    } else {
      result.push({ ...current });
    }
  }

  return result;
}
