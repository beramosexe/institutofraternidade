-- Additive provenance metadata for normalized transcript segments.
-- Existing JSON records remain valid; old/manual segments without provenance are untouched.
-- RAW provider segments and historical runs are not modified.
comment on column public.audio_transcriptions.normalized_segments is
  'Timestamp-preserving normalized segments. New generated segments may include source_segments indexes pointing into raw_segments.';

