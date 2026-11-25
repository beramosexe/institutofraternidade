export type RawTranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: number;
};

export type NormalizationGroup = {
  source_segments: number[];
  text: string;
};

/**
 * A normalized sentence keeps its original timeline and exact RAW segment
 * indexes that produced it. Optional for legacy/manual edits.
 */
export type NormalizedTranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  source_segments?: number[];
};

/** Future document-oriented representation; not yet persisted or rendered. */
export type TranscriptParagraph = {
  id: string;
  sentence_ids: string[];
};

export type TranscriptSentence = NormalizedTranscriptSegment & {
  id: string;
  paragraph_id?: string | null;
};
