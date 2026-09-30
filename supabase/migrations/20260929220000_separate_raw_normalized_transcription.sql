-- Separate provider RAW transcription from the reviewed/normalized representation.
-- Existing rows are preserved in both layers as a safe legacy baseline.
alter table public.audio_transcriptions
  add column if not exists raw_text text,
  add column if not exists raw_segments jsonb,
  add column if not exists normalized_text text,
  add column if not exists normalized_segments jsonb,
  add column if not exists normalization_status text not null default 'not_started',
  add column if not exists raw_provider_response jsonb;

alter table public.audio_transcriptions
  add constraint audio_transcriptions_normalization_status_check
  check (normalization_status in ('not_started', 'in_progress', 'normalized', 'reviewed'));

update public.audio_transcriptions
set
  raw_text = coalesce(raw_text, text),
  raw_segments = coalesce(raw_segments, segments),
  normalized_text = coalesce(normalized_text, text),
  normalized_segments = coalesce(normalized_segments, segments)
where raw_text is null
   or raw_segments is null
   or normalized_text is null
   or normalized_segments is null;

comment on column public.audio_transcriptions.raw_text is
  'Immutable transcription text returned by the STT provider.';
comment on column public.audio_transcriptions.raw_segments is
  'Immutable timestamped segments returned by the STT provider, before display grouping or human editing.';
comment on column public.audio_transcriptions.normalized_text is
  'Separate linguistic/reviewed transcription. May be null until normalization starts.';
comment on column public.audio_transcriptions.normalized_segments is
  'Separate timestamp-preserving normalized/reviewed segments.';
comment on column public.audio_transcriptions.normalization_status is
  'Lifecycle of the normalized representation; does not describe the provider RAW transcription.';
comment on column public.audio_transcriptions.raw_provider_response is
  'Optional provider response snapshot for diagnostics and reproducibility.';

