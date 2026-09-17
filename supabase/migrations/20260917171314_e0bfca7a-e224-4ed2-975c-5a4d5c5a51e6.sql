ALTER TABLE public.social_media_posts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurrence_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_minutes integer;

ALTER TABLE public.social_media_posts
  ADD CONSTRAINT social_media_posts_source_check CHECK (source IN ('manual', 'work_reminder')),
  ADD CONSTRAINT social_media_posts_approval_mode_check CHECK (approval_mode IN ('manual', 'automatic')),
  ADD CONSTRAINT social_media_posts_status_check CHECK (status IN ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  ADD CONSTRAINT social_media_posts_channels_check CHECK (channels <@ ARRAY['instagram','facebook']::text[] AND cardinality(channels) > 0);

CREATE INDEX IF NOT EXISTS social_media_posts_status_schedule_idx ON public.social_media_posts(status, scheduled_for);
CREATE UNIQUE INDEX IF NOT EXISTS social_media_posts_reminder_unique_idx
  ON public.social_media_posts(work_id, occurrence_at, reminder_minutes)
  WHERE source = 'work_reminder';

CREATE TABLE public.work_social_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  channels text[] NOT NULL DEFAULT ARRAY['instagram','facebook']::text[],
  reminder_minutes integer[] NOT NULL DEFAULT ARRAY[10080,1440]::integer[],
  template_text text NOT NULL DEFAULT 'Participe do {{work_name}} em {{date}} às {{time}}. {{location}}',
  media_url text,
  approval_mode text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_social_settings_channels_check CHECK (channels <@ ARRAY['instagram','facebook']::text[] AND cardinality(channels) > 0),
  CONSTRAINT work_social_settings_reminders_check CHECK (cardinality(reminder_minutes) > 0 AND cardinality(reminder_minutes) <= 6),
  CONSTRAINT work_social_settings_approval_check CHECK (approval_mode IN ('manual','automatic'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_social_settings TO authenticated;
GRANT ALL ON public.work_social_settings TO service_role;
ALTER TABLE public.work_social_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_social_settings_media_manage ON public.work_social_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE TABLE public.social_post_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_post_id text,
  provider_url text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, channel),
  CONSTRAINT social_post_deliveries_channel_check CHECK (channel IN ('instagram','facebook')),
  CONSTRAINT social_post_deliveries_status_check CHECK (status IN ('pending','publishing','published','failed','cancelled'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_deliveries TO authenticated;
GRANT ALL ON public.social_post_deliveries TO service_role;
ALTER TABLE public.social_post_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_post_deliveries_media_manage ON public.social_post_deliveries
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_posts TO authenticated;
GRANT ALL ON public.social_media_posts TO service_role;

DROP POLICY IF EXISTS "Gerenciamento de agendamentos sociais pelo criador" ON public.social_media_posts;
DROP POLICY IF EXISTS social_posts_read_staff ON public.social_media_posts;
CREATE POLICY social_media_posts_media_manage ON public.social_media_posts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE TRIGGER update_work_social_settings_updated_at
  BEFORE UPDATE ON public.work_social_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_social_post_deliveries_updated_at
  BEFORE UPDATE ON public.social_post_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();