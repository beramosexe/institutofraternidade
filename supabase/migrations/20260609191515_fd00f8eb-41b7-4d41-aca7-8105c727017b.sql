
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_permission AS ENUM (
  'audio.upload',
  'audio.edit_any',
  'audio.delete',
  'audio.publish',
  'audio.reprocess',
  'transcription.review',
  'transcription.approve',
  'work.manage',
  'user.manage',
  'role.manage',
  'logs.view'
);

CREATE TYPE public.work_status AS ENUM ('draft', 'published', 'completed', 'archived');
CREATE TYPE public.work_visibility AS ENUM ('public', 'internal');
CREATE TYPE public.audio_type AS ENUM ('canalizacao', 'outro');
CREATE TYPE public.audio_access_level AS ENUM ('public', 'associates', 'work_participants', 'attendees_only');
CREATE TYPE public.audio_status AS ENUM ('uploaded', 'converting', 'transcribing', 'ready', 'error', 'archived');
CREATE TYPE public.review_status AS ENUM ('unreviewed', 'in_review', 'reviewed');
CREATE TYPE public.job_type AS ENUM ('convert', 'transcribe');
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'done', 'error');

-- =====================================================================
-- UPDATED_AT TRIGGER FN
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- ROLES & PERMISSIONS
-- =====================================================================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  PRIMARY KEY (role_id, permission)
);
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECURITY DEFINER FUNCTIONS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.slug = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission public.app_permission)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id) OR EXISTS(
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = _user_id AND rp.permission = _permission
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role_slug(_user_id UUID, _slug TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.slug = _slug
  );
$$;

CREATE OR REPLACE FUNCTION public.is_associate(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR public.has_role_slug(_user_id, 'associate')
      OR public.has_role_slug(_user_id, 'uploader')
      OR public.has_role_slug(_user_id, 'reviewer');
$$;

-- =====================================================================
-- PROFILES POLICIES
-- =====================================================================
CREATE POLICY "profiles read all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles admin all" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================================
-- ROLES POLICIES
-- =====================================================================
CREATE POLICY "roles read authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles admin write" ON public.roles
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'role.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'role.manage'));

CREATE POLICY "role_permissions read authenticated" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'role.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'role.manage'));

CREATE POLICY "user_roles read own or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'user.manage'));
CREATE POLICY "user_roles admin write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'user.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'user.manage'));

-- =====================================================================
-- WORKS
-- =====================================================================
CREATE TABLE public.works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  status public.work_status NOT NULL DEFAULT 'draft',
  visibility public.work_visibility NOT NULL DEFAULT 'internal',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.works TO authenticated;
GRANT SELECT ON public.works TO anon;
GRANT ALL ON public.works TO service_role;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_works_updated_at BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "works public read" ON public.works
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public' AND status IN ('published', 'completed'));
CREATE POLICY "works associates read" ON public.works
  FOR SELECT TO authenticated
  USING (public.is_associate(auth.uid()));
CREATE POLICY "works manage" ON public.works
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'work.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'work.manage'));

-- =====================================================================
-- WORK PARTICIPANTS
-- =====================================================================
CREATE TABLE public.work_participants (
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (work_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.work_participants TO authenticated;
GRANT ALL ON public.work_participants TO service_role;
ALTER TABLE public.work_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wp read own or manager" ON public.work_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'work.manage'));
CREATE POLICY "wp manage" ON public.work_participants
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'work.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'work.manage'));

-- =====================================================================
-- ATTENDANCE (estrutura para check-in futuro)
-- =====================================================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  UNIQUE (work_id, user_id, checked_in_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance read own or manager" ON public.attendance
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'work.manage'));
CREATE POLICY "attendance manage" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'work.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'work.manage'));

-- =====================================================================
-- AUDIOS
-- =====================================================================
CREATE TABLE public.audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID REFERENCES public.works(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  recorded_at DATE,
  audio_type public.audio_type NOT NULL DEFAULT 'canalizacao',
  message_source TEXT,
  access_level public.audio_access_level NOT NULL DEFAULT 'associates',
  storage_path TEXT NOT NULL,
  stream_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ DEFAULT now(),
  status public.audio_status NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audios TO authenticated;
GRANT SELECT ON public.audios TO anon;
GRANT ALL ON public.audios TO service_role;
ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_audios_updated_at BEFORE UPDATE ON public.audios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_audios_work ON public.audios(work_id);
CREATE INDEX idx_audios_status ON public.audios(status);
CREATE INDEX idx_audios_access ON public.audios(access_level);

-- Access function
CREATE OR REPLACE FUNCTION public.can_access_audio(_audio_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT * INTO a FROM public.audios WHERE id = _audio_id;
  IF a IS NULL THEN RETURN false; END IF;
  IF a.status = 'archived' AND NOT public.is_admin(_user_id) THEN RETURN false; END IF;
  IF a.access_level = 'public' THEN RETURN true; END IF;
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_admin(_user_id) THEN RETURN true; END IF;
  IF a.uploaded_by = _user_id THEN RETURN true; END IF;
  IF a.access_level = 'associates' THEN RETURN public.is_associate(_user_id); END IF;
  IF a.access_level = 'work_participants' THEN
    RETURN EXISTS(SELECT 1 FROM public.work_participants
                  WHERE work_id = a.work_id AND user_id = _user_id);
  END IF;
  IF a.access_level = 'attendees_only' THEN
    RETURN EXISTS(SELECT 1 FROM public.attendance
                  WHERE work_id = a.work_id AND user_id = _user_id);
  END IF;
  RETURN false;
END;
$$;

CREATE POLICY "audios public read" ON public.audios
  FOR SELECT TO anon
  USING (access_level = 'public' AND status = 'ready');
CREATE POLICY "audios authenticated read" ON public.audios
  FOR SELECT TO authenticated
  USING (public.can_access_audio(id, auth.uid()));
CREATE POLICY "audios uploader insert" ON public.audios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'audio.upload') AND uploaded_by = auth.uid());
CREATE POLICY "audios uploader update own" ON public.audios
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_permission(auth.uid(), 'audio.edit_any'))
  WITH CHECK (uploaded_by = auth.uid() OR public.has_permission(auth.uid(), 'audio.edit_any'));
CREATE POLICY "audios delete" ON public.audios
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'audio.delete'));

-- =====================================================================
-- AUDIO TRANSCRIPTIONS
-- =====================================================================
CREATE TABLE public.audio_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_id UUID NOT NULL UNIQUE REFERENCES public.audios(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'pt',
  text TEXT NOT NULL DEFAULT '',
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT,
  review_status public.review_status NOT NULL DEFAULT 'unreviewed',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(text, ''))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_transcriptions TO authenticated;
GRANT SELECT ON public.audio_transcriptions TO anon;
GRANT ALL ON public.audio_transcriptions TO service_role;
ALTER TABLE public.audio_transcriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_transcriptions_updated_at BEFORE UPDATE ON public.audio_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_transcriptions_fts ON public.audio_transcriptions USING gin(search_vector);

CREATE POLICY "transcriptions read via audio" ON public.audio_transcriptions
  FOR SELECT TO anon, authenticated
  USING (public.can_access_audio(audio_id, auth.uid()));
CREATE POLICY "transcriptions reviewer update" ON public.audio_transcriptions
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'transcription.review')
    OR EXISTS(SELECT 1 FROM public.audios WHERE id = audio_id AND uploaded_by = auth.uid())
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'transcription.review')
    OR EXISTS(SELECT 1 FROM public.audios WHERE id = audio_id AND uploaded_by = auth.uid())
  );

CREATE TABLE public.transcription_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id UUID NOT NULL REFERENCES public.audio_transcriptions(id) ON DELETE CASCADE,
  editor_id UUID REFERENCES auth.users(id),
  segments_before JSONB,
  segments_after JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transcription_revisions TO authenticated;
GRANT ALL ON public.transcription_revisions TO service_role;
ALTER TABLE public.transcription_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revisions read by reviewer" ON public.transcription_revisions
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'transcription.review') OR editor_id = auth.uid());
CREATE POLICY "revisions insert by editor" ON public.transcription_revisions
  FOR INSERT TO authenticated WITH CHECK (editor_id = auth.uid());

-- =====================================================================
-- PROCESSING JOBS
-- =====================================================================
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_id UUID NOT NULL REFERENCES public.audios(id) ON DELETE CASCADE,
  job_type public.job_type NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.processing_jobs TO authenticated;
GRANT ALL ON public.processing_jobs TO service_role;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs read for uploader or admin" ON public.processing_jobs
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'audio.reprocess')
    OR EXISTS(SELECT 1 FROM public.audios WHERE id = audio_id AND uploaded_by = auth.uid())
  );

-- =====================================================================
-- AUDIT LOGS
-- =====================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE POLICY "audit read by viewer" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'logs.view'));
CREATE POLICY "audit insert authenticated" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- =====================================================================
-- AUTO-CREATE PROFILE & ASSIGN DEFAULT ROLE
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first_user;

  IF is_first_user THEN
    SELECT id INTO default_role_id FROM public.roles WHERE slug = 'admin' LIMIT 1;
  ELSE
    SELECT id INTO default_role_id FROM public.roles WHERE slug = 'associate' LIMIT 1;
  END IF;

  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id) VALUES (NEW.id, default_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
