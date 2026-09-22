ALTER TYPE public.work_status ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE public.work_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.social_media_posts
  DROP CONSTRAINT IF EXISTS social_media_posts_source_check,
  DROP CONSTRAINT IF EXISTS social_media_posts_channels_check,
  DROP CONSTRAINT IF EXISTS social_media_posts_status_check;

ALTER TABLE public.social_media_posts
  ADD COLUMN IF NOT EXISTS communication_kind text NOT NULL DEFAULT 'publication',
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'one_off',
  ADD COLUMN IF NOT EXISTS recurrence_weekday smallint,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays smallint[],
  ADD COLUMN IF NOT EXISTS recurrence_time time,
  ADD COLUMN IF NOT EXISTS recurrence_ends_on date,
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS rule_id uuid,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS visual_reference_url text,
  ADD COLUMN IF NOT EXISTS aesthetic_instruction text,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.social_media_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.social_media_posts
  ADD CONSTRAINT social_media_posts_source_check CHECK (source IN ('manual','work_reminder','work_postponed','work_cancelled','operational_alert','legacy_communication')),
  ADD CONSTRAINT social_media_posts_status_check CHECK (status IN ('draft','pending_approval','scheduled','publishing','published','failed','cancelled')),
  ADD CONSTRAINT social_media_posts_channels_check CHECK (cardinality(channels) > 0 AND channels <@ ARRAY['instagram','facebook','whatsapp','email','telegram','youtube']::text[]),
  ADD CONSTRAINT social_media_posts_kind_check CHECK (communication_kind IN ('publication','work_notice','work_postponed','work_cancelled','operational_alert')),
  ADD CONSTRAINT social_media_posts_schedule_check CHECK (schedule_type IN ('one_off','recurring','automatic')),
  ADD CONSTRAINT social_media_posts_recurrence_weekday_check CHECK (recurrence_weekday IS NULL OR recurrence_weekday BETWEEN 0 AND 6),
  ADD CONSTRAINT social_media_posts_recurrence_weekdays_check CHECK (recurrence_weekdays IS NULL OR recurrence_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  ADD CONSTRAINT social_media_posts_recurring_fields_check CHECK (schedule_type <> 'recurring' OR (recurrence_weekday IS NOT NULL AND recurrence_time IS NOT NULL));

INSERT INTO public.social_media_posts (
  title, content_text, channels, scheduled_for, status, source, communication_kind,
  schedule_type, published_at, created_by, created_at, updated_at
)
SELECT
  'Comunicado importado', c.message, c.platforms,
  COALESCE(c.sent_at, c.created_at),
  CASE WHEN c.status = 'sent' THEN 'published' ELSE 'draft' END,
  'legacy_communication', 'publication', 'one_off', c.sent_at,
  c.created_by, c.created_at, c.updated_at
FROM public.communications c
WHERE NOT EXISTS (
  SELECT 1 FROM public.social_media_posts p
  WHERE p.source = 'legacy_communication'
    AND p.created_at = c.created_at
    AND p.content_text = c.message
);

CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'work_notice',
  text_instruction text,
  visual_reference_url text,
  aesthetic_instruction text,
  suggested_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_templates_kind_check CHECK (kind IN ('work_notice','work_postponed','work_cancelled','publication','operational_alert')),
  CONSTRAINT communication_templates_channels_check CHECK (suggested_channels <@ ARRAY['instagram','facebook','whatsapp','email','telegram','youtube']::text[])
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_templates TO authenticated;
GRANT ALL ON public.communication_templates TO service_role;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_templates_media_manage ON public.communication_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE TABLE public.communication_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  destination_type text NOT NULL,
  name text NOT NULL,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_destinations_channel_check CHECK (channel IN ('instagram','facebook','whatsapp','email','telegram','youtube')),
  CONSTRAINT communication_destinations_type_check CHECK (destination_type IN ('account','group','list','contact')),
  UNIQUE(channel, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_destinations TO authenticated;
GRANT ALL ON public.communication_destinations TO service_role;
ALTER TABLE public.communication_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_destinations_media_manage ON public.communication_destinations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE TABLE public.communication_target_links (
  communication_id uuid NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.communication_destinations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (communication_id, destination_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_target_links TO authenticated;
GRANT ALL ON public.communication_target_links TO service_role;
ALTER TABLE public.communication_target_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_target_links_media_manage ON public.communication_target_links
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE TABLE public.work_communication_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  name text NOT NULL,
  offset_value integer NOT NULL,
  offset_unit text NOT NULL,
  channels text[] NOT NULL,
  content_text text NOT NULL,
  media_url text,
  approval_mode text NOT NULL DEFAULT 'manual',
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  visual_reference_url text,
  aesthetic_instruction text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_communication_rules_offset_check CHECK (offset_value > 0 AND offset_value <= 525600),
  CONSTRAINT work_communication_rules_unit_check CHECK (offset_unit IN ('minutes','hours','days','weeks')),
  CONSTRAINT work_communication_rules_channels_check CHECK (cardinality(channels) > 0 AND channels <@ ARRAY['instagram','facebook','whatsapp','email','telegram','youtube']::text[]),
  CONSTRAINT work_communication_rules_approval_check CHECK (approval_mode IN ('manual','automatic'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_communication_rules TO authenticated;
GRANT ALL ON public.work_communication_rules TO service_role;
ALTER TABLE public.work_communication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_communication_rules_media_manage ON public.work_communication_rules
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage') OR public.has_permission(auth.uid(), 'work.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage') OR public.has_permission(auth.uid(), 'work.manage'));

INSERT INTO public.work_communication_rules (
  work_id, name, offset_value, offset_unit, channels, content_text, media_url,
  approval_mode, is_active, sort_order, created_by, created_at, updated_at
)
SELECT
  s.work_id,
  CASE
    WHEN r.minutes % 10080 = 0 THEN (r.minutes / 10080)::text || ' semana(s) antes'
    WHEN r.minutes % 1440 = 0 THEN (r.minutes / 1440)::text || ' dia(s) antes'
    WHEN r.minutes % 60 = 0 THEN (r.minutes / 60)::text || ' hora(s) antes'
    ELSE r.minutes::text || ' minuto(s) antes'
  END,
  CASE
    WHEN r.minutes % 10080 = 0 THEN r.minutes / 10080
    WHEN r.minutes % 1440 = 0 THEN r.minutes / 1440
    WHEN r.minutes % 60 = 0 THEN r.minutes / 60
    ELSE r.minutes
  END,
  CASE
    WHEN r.minutes % 10080 = 0 THEN 'weeks'
    WHEN r.minutes % 1440 = 0 THEN 'days'
    WHEN r.minutes % 60 = 0 THEN 'hours'
    ELSE 'minutes'
  END,
  s.channels, s.template_text, s.media_url, s.approval_mode, s.enabled,
  r.ordinality::integer, s.created_by, s.created_at, s.updated_at
FROM public.work_social_settings s
CROSS JOIN LATERAL unnest(s.reminder_minutes) WITH ORDINALITY AS r(minutes, ordinality)
WHERE NOT EXISTS (
  SELECT 1 FROM public.work_communication_rules x
  WHERE x.work_id = s.work_id AND x.sort_order = r.ordinality::integer
);

ALTER TABLE public.social_media_posts
  ADD CONSTRAINT social_media_posts_rule_fk FOREIGN KEY (rule_id) REFERENCES public.work_communication_rules(id) ON DELETE SET NULL,
  ADD CONSTRAINT social_media_posts_template_fk FOREIGN KEY (template_id) REFERENCES public.communication_templates(id) ON DELETE SET NULL;

CREATE TABLE public.work_occurrence_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  original_starts_at timestamptz NOT NULL,
  action text NOT NULL,
  new_starts_at timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_occurrence_exceptions_action_check CHECK (action IN ('postponed','cancelled')),
  CONSTRAINT work_occurrence_exceptions_postponed_check CHECK (action <> 'postponed' OR new_starts_at IS NOT NULL),
  UNIQUE(work_id, original_starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_occurrence_exceptions TO authenticated;
GRANT ALL ON public.work_occurrence_exceptions TO service_role;
GRANT SELECT ON public.work_occurrence_exceptions TO anon;
ALTER TABLE public.work_occurrence_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_occurrence_exceptions_public_read ON public.work_occurrence_exceptions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.visibility = 'public'));
CREATE POLICY work_occurrence_exceptions_manage ON public.work_occurrence_exceptions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id));

ALTER TABLE public.social_post_deliveries
  DROP CONSTRAINT IF EXISTS social_post_deliveries_post_id_channel_key,
  DROP CONSTRAINT IF EXISTS social_post_deliveries_channel_check,
  DROP CONSTRAINT IF EXISTS social_post_deliveries_status_check,
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES public.communication_destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD CONSTRAINT social_post_deliveries_channel_check CHECK (channel IN ('instagram','facebook','whatsapp','email','telegram','youtube')),
  ADD CONSTRAINT social_post_deliveries_status_check CHECK (status IN ('pending','publishing','accepted','sent','delivered','read','published','failed','cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS social_post_deliveries_target_unique_idx
  ON public.social_post_deliveries(post_id, channel, COALESCE(destination_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  next_retry_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_webhook_events_media_read ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'media.manage'));

CREATE INDEX IF NOT EXISTS communication_schedule_idx ON public.social_media_posts(status, scheduled_for) WHERE status IN ('scheduled','failed');
CREATE INDEX IF NOT EXISTS communication_work_idx ON public.social_media_posts(work_id, occurrence_at);
CREATE INDEX IF NOT EXISTS work_communication_rules_work_idx ON public.work_communication_rules(work_id, sort_order);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_pending_idx ON public.whatsapp_webhook_events(processed_at, next_retry_at);

CREATE TRIGGER update_communication_templates_updated_at BEFORE UPDATE ON public.communication_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_communication_destinations_updated_at BEFORE UPDATE ON public.communication_destinations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_work_communication_rules_updated_at BEFORE UPDATE ON public.work_communication_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_work_occurrence_exceptions_updated_at BEFORE UPDATE ON public.work_occurrence_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();