CREATE TABLE public.audio_upload_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Atalho do iPhone',
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  default_access_level public.audio_access_level NOT NULL DEFAULT 'associates',
  default_work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_upload_tokens TO authenticated;
GRANT ALL ON public.audio_upload_tokens TO service_role;

ALTER TABLE public.audio_upload_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their upload tokens"
ON public.audio_upload_tokens FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tg_audio_upload_tokens_updated_at
BEFORE UPDATE ON public.audio_upload_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_audio_upload_tokens_user ON public.audio_upload_tokens(user_id);

CREATE INDEX idx_audios_keywords ON public.audios USING gin (keywords);
CREATE INDEX idx_audios_summary_trgm_fallback ON public.audios ((lower(coalesce(summary,''))));
CREATE INDEX idx_audios_play_count ON public.audios (play_count DESC);