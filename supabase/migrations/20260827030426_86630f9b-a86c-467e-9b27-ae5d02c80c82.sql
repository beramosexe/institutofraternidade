-- helper: who can manage members / classes
CREATE OR REPLACE FUNCTION public.can_manage_members(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR public.has_permission(_user_id, 'member.manage')
      OR public.has_permission(_user_id, 'member.validate');
$$;
REVOKE ALL ON FUNCTION public.can_manage_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_members(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_classes(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR public.has_permission(_user_id, 'class.manage')
      OR public.has_permission(_user_id, 'member.manage');
$$;
REVOKE ALL ON FUNCTION public.can_manage_classes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_classes(uuid) TO authenticated, service_role;

-- 1) critical permissions
CREATE TABLE IF NOT EXISTS public.critical_permissions (
  permission public.app_permission PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.critical_permissions TO authenticated;
GRANT ALL ON public.critical_permissions TO service_role;
ALTER TABLE public.critical_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_read_auth" ON public.critical_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_admin_write" ON public.critical_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.critical_permissions (permission, note) VALUES
  ('audio.delete', 'Exclusão definitiva de registros'),
  ('logs.view', 'Acesso à auditoria'),
  ('role.manage', 'Gestão de cargos e permissões')
ON CONFLICT DO NOTHING;

-- 2) formation levels
CREATE TABLE IF NOT EXISTS public.formation_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.formation_levels TO authenticated;
GRANT ALL ON public.formation_levels TO service_role;
ALTER TABLE public.formation_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fl_read_auth" ON public.formation_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "fl_write" ON public.formation_levels FOR ALL TO authenticated
  USING (public.can_manage_classes(auth.uid())) WITH CHECK (public.can_manage_classes(auth.uid()));
CREATE TRIGGER tg_formation_levels_updated_at BEFORE UPDATE ON public.formation_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.formation_levels (name, sort_order) VALUES
  ('Básico', 1), ('Intermediário', 2), ('Avançado', 3), ('Instrutores', 4), ('Mediunidade', 5)
ON CONFLICT (name) DO NOTHING;

-- 3) classes
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_id uuid REFERENCES public.formation_levels(id) ON DELETE SET NULL,
  period text,
  status public.class_status NOT NULL DEFAULT 'planned',
  opened_at date,
  closed_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes_read_auth" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_write" ON public.classes FOR ALL TO authenticated
  USING (public.can_manage_classes(auth.uid())) WITH CHECK (public.can_manage_classes(auth.uid()));
CREATE TRIGGER tg_classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) class members
CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  purpose text,
  joined_at date NOT NULL DEFAULT current_date,
  left_at date,
  status public.class_member_status NOT NULL DEFAULT 'active',
  notes text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON public.class_members(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm_read_own_or_manager" ON public.class_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_classes(auth.uid()));
CREATE POLICY "cm_write" ON public.class_members FOR ALL TO authenticated
  USING (public.can_manage_classes(auth.uid())) WITH CHECK (public.can_manage_classes(auth.uid()));
CREATE TRIGGER tg_class_members_updated_at BEFORE UPDATE ON public.class_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) activity periods
CREATE TABLE IF NOT EXISTS public.member_status_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.membership_status NOT NULL,
  started_on date NOT NULL DEFAULT current_date,
  ended_on date,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msp_user ON public.member_status_periods(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_status_periods TO authenticated;
GRANT ALL ON public.member_status_periods TO service_role;
ALTER TABLE public.member_status_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msp_read_own_or_manager" ON public.member_status_periods FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_members(auth.uid()));
CREATE POLICY "msp_write" ON public.member_status_periods FOR ALL TO authenticated
  USING (public.can_manage_members(auth.uid())) WITH CHECK (public.can_manage_members(auth.uid()));

-- 6) member timeline events
CREATE TABLE IF NOT EXISTS public.member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  details jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_events_user ON public.member_events(user_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.member_events TO authenticated;
GRANT ALL ON public.member_events TO service_role;
ALTER TABLE public.member_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "me_read_own_or_manager" ON public.member_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_members(auth.uid()));
CREATE POLICY "me_insert_manager" ON public.member_events FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_members(auth.uid()));

-- 7) system settings (signup PIN hash)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
-- no client access at all: only server (service role) reads/writes the PIN hash

-- 8) retroactive access rule
CREATE OR REPLACE FUNCTION public.was_active_at(_user_id uuid, _at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.member_status_periods WHERE user_id = _user_id)
      THEN (SELECT membership_status = 'active' FROM public.profiles WHERE id = _user_id)
    ELSE EXISTS (
      SELECT 1 FROM public.member_status_periods p
      WHERE p.user_id = _user_id
        AND p.status = 'active'
        AND p.started_on <= coalesce(_at, now())::date
        AND (p.ended_on IS NULL OR p.ended_on >= coalesce(_at, now())::date)
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.was_active_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.was_active_at(uuid, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_associate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR (
        (SELECT membership_status FROM public.profiles WHERE id = _user_id) = 'active'
        AND (
          public.has_role_slug(_user_id, 'associate')
          OR public.has_role_slug(_user_id, 'uploader')
          OR public.has_role_slug(_user_id, 'reviewer')
        )
      );
$$;

CREATE OR REPLACE FUNCTION public.can_access_audio(_audio_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  -- restricted content requires the member to have been active when it was published
  IF NOT public.was_active_at(_user_id, coalesce(a.published_at, a.created_at)) THEN
    RETURN false;
  END IF;
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

-- 9) new accounts start pending with no internal role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_role_id UUID;
  is_first_user BOOLEAN;
  inv RECORD;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first_user;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, membership_status)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN is_first_user THEN 'active'::public.membership_status ELSE 'pending'::public.membership_status END
  )
  ON CONFLICT (id) DO NOTHING;

  IF is_first_user THEN
    SELECT id INTO admin_role_id FROM public.roles WHERE slug = 'admin' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id) VALUES (NEW.id, admin_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.member_status_periods (user_id, status, reason)
    VALUES (NEW.id, 'active', 'Primeiro usuário do sistema');
  END IF;

  IF NEW.email IS NOT NULL THEN
    FOR inv IN
      SELECT * FROM public.pending_invites
      WHERE consumed_at IS NULL AND lower(email) = lower(NEW.email)
    LOOP
      UPDATE public.pending_invites SET consumed_at = now() WHERE id = inv.id;
      IF inv.work_id IS NOT NULL THEN
        INSERT INTO public.work_participants (work_id, user_id)
        VALUES (inv.work_id, NEW.id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    UPDATE public.attendance
       SET invited_user_id = NEW.id
     WHERE invited_user_id IS NULL
       AND user_id IS NULL
       AND guest_email IS NOT NULL
       AND lower(guest_email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- 10) backfill active periods for existing active members
INSERT INTO public.member_status_periods (user_id, status, started_on, reason)
SELECT p.id, 'active', p.created_at::date, 'Registro histórico inicial'
  FROM public.profiles p
 WHERE p.membership_status = 'active'
   AND NOT EXISTS (SELECT 1 FROM public.member_status_periods m WHERE m.user_id = p.id);

-- 11) managers can read/update member profiles
DROP POLICY IF EXISTS "profiles_manager_read" ON public.profiles;
CREATE POLICY "profiles_manager_read" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_manage_members(auth.uid()));
DROP POLICY IF EXISTS "profiles_manager_update" ON public.profiles;
CREATE POLICY "profiles_manager_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.can_manage_members(auth.uid())) WITH CHECK (public.can_manage_members(auth.uid()));
