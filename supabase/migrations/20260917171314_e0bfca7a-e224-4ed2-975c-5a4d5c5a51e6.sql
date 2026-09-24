-- Recovery bootstrap for the media schema.
-- The original CREATE TABLE migrations for these legacy media tables were not
-- present in the versioned migration history. Creating them here lets both the
-- partially migrated remote database and clean installations converge without
-- editing Supabase migration history.

CREATE TABLE IF NOT EXISTS public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  platforms text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tg_communications_updated_at
BEFORE UPDATE ON public.communications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  DROP POLICY IF EXISTS "communications_read_staff" ON public.communications;
  CREATE POLICY "communications_read_staff"
    ON public.communications FOR SELECT TO authenticated
    USING (
      created_by = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'media.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'notification.manage'::app_permission)
    );

  DROP POLICY IF EXISTS "Gerenciamento de comunicados pelo criador" ON public.communications;
  CREATE POLICY "Gerenciamento de comunicados pelo criador"
    ON public.communications FOR ALL TO authenticated
    USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
END $$;

CREATE TABLE IF NOT EXISTS public.site_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  content text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON TABLE public.site_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_posts TO authenticated;
GRANT ALL ON TABLE public.site_posts TO service_role;
ALTER TABLE public.site_posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tg_site_posts_updated_at
BEFORE UPDATE ON public.site_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS site_posts_status_published_idx
  ON public.site_posts(status, published_at DESC);

DO $$
BEGIN
  DROP POLICY IF EXISTS "site_posts_public_read_published" ON public.site_posts;
  CREATE POLICY "site_posts_public_read_published"
    ON public.site_posts FOR SELECT TO anon, authenticated
    USING (
      (status = 'published' AND published_at IS NOT NULL AND published_at <= now())
      OR author_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'media.manage'::app_permission)
    );

  DROP POLICY IF EXISTS "Autores gerenciam seus próprios posts no site" ON public.site_posts;
  CREATE POLICY "Autores gerenciam seus próprios posts no site"
    ON public.site_posts FOR ALL TO authenticated
    USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
END $$;

CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_text text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['instagram']::text[],
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_posts TO authenticated;
GRANT ALL ON public.social_media_posts TO service_role;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tg_social_media_posts_updated_at
BEFORE UPDATE ON public.social_media_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS social_media_posts_created_idx
  ON public.social_media_posts(created_at DESC);

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