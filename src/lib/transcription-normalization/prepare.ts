import type { RawTranscriptSegment } from "./types";

export function prepareNormalizationInput(segments: RawTranscriptSegment[]) {
  return segments.map((segment, index) => ({
    index,
    start: segment.start,
    end: segment.end,
    ...(typeof segment.speaker === "number" ? { speaker: segment.speaker } : {}),
    text: segment.text.trim(),
  }));
}
