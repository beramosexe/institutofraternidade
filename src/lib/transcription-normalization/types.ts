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

export type NormalizedTranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: number;
};
