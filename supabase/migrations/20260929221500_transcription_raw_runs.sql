-- Keep every STT provider result as an immutable run.
-- The current RAW fields on audio_transcriptions represent the latest run;
-- this table preserves previous RAW results across reprocessing.
create table if not exists public.audio_transcription_runs (
  id uuid primary key default gen_random_uuid(),
  audio_id uuid not null references public.audios(id) on delete cascade,
  transcription_id uuid references public.audio_transcriptions(id) on delete set null,
  provider text not null,
  model text not null,
  language text,
  raw_text text not null,
  raw_segments jsonb not null default '[]'::jsonb,
  raw_provider_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audio_transcription_runs_audio_id_idx
  on public.audio_transcription_runs(audio_id, created_at desc);

create index if not exists audio_transcription_runs_transcription_id_idx
  on public.audio_transcription_runs(transcription_id, created_at desc);

alter table public.audio_transcription_runs enable row level security;

comment on table public.audio_transcription_runs is
  'Immutable history of STT provider outputs. Never use this table for normalized/reviewed text.';

comment on column public.audio_transcription_runs.raw_segments is
  'Timestamped provider output before any display grouping, normalization or human editing.';
