
-- ============================================================
-- 1. Channeling entities (global) + favoritas por trabalho
-- ============================================================
CREATE TABLE public.channeling_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channeling_entities TO authenticated;
GRANT ALL ON public.channeling_entities TO service_role;
ALTER TABLE public.channeling_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities associates read" ON public.channeling_entities
  FOR SELECT TO authenticated USING (public.is_associate(auth.uid()));
CREATE POLICY "entities admin manage" ON public.channeling_entities
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'user.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'user.manage'));

CREATE TRIGGER tg_entities_updated_at BEFORE UPDATE ON public.channeling_entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.work_entity_favorites (
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.channeling_entities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (work_id, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_entity_favorites TO authenticated;
GRANT ALL ON public.work_entity_favorites TO service_role;
ALTER TABLE public.work_entity_favorites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Works: recurrence, modality, template, responsibles
-- ============================================================
ALTER TABLE public.works
  ADD COLUMN modality text CHECK (modality IN ('presencial','online','hibrido','externo')),
  ADD COLUMN recurrence text NOT NULL DEFAULT 'one_off' CHECK (recurrence IN ('one_off','weekly')),
  ADD COLUMN recurrence_weekday smallint CHECK (recurrence_weekday BETWEEN 0 AND 6),
  ADD COLUMN recurrence_time time,
  ADD COLUMN is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN template_id uuid REFERENCES public.works(id) ON DELETE SET NULL;

CREATE INDEX idx_works_template ON public.works(template_id);
CREATE INDEX idx_works_is_template ON public.works(is_template) WHERE is_template = true;

CREATE TABLE public.work_responsibles (
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (work_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_responsibles TO authenticated;
GRANT ALL ON public.work_responsibles TO service_role;
ALTER TABLE public.work_responsibles ENABLE ROW LEVEL SECURITY;

-- helper function (defined here so policies below can reference it)
CREATE OR REPLACE FUNCTION public.is_work_responsible(_user_id uuid, _work_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.work_responsibles
    WHERE user_id = _user_id AND work_id = _work_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_work_responsible(uuid, uuid) TO authenticated, anon;

-- Policies for work_responsibles & work_entity_favorites (need fn above)
CREATE POLICY "wr associates read" ON public.work_responsibles
  FOR SELECT TO authenticated USING (public.is_associate(auth.uid()));
CREATE POLICY "wr manage" ON public.work_responsibles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage')
         OR public.is_work_responsible(auth.uid(), work_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage')
              OR public.is_work_responsible(auth.uid(), work_id));

CREATE POLICY "wef associates read" ON public.work_entity_favorites
  FOR SELECT TO authenticated USING (public.is_associate(auth.uid()));
CREATE POLICY "wef manage" ON public.work_entity_favorites
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage')
         OR public.is_work_responsible(auth.uid(), work_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'work.manage')
              OR public.is_work_responsible(auth.uid(), work_id));

-- Extend works "manage" policy: responsibles can update their work
DROP POLICY IF EXISTS "works manage" ON public.works;
CREATE POLICY "works manage" ON public.works
  FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'work.manage')
    OR public.is_work_responsible(auth.uid(), id)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'work.manage')
    OR public.is_work_responsible(auth.uid(), id)
  );

-- Extend work_participants manage
DROP POLICY IF EXISTS "wp manage" ON public.work_participants;
CREATE POLICY "wp manage" ON public.work_participants
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id))
  WITH CHECK (public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id));

-- ============================================================
-- 3. Attendance: occurrence_date + guest fields
-- ============================================================
ALTER TABLE public.attendance
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN occurrence_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN guest_name text,
  ADD COLUMN guest_email text,
  ADD COLUMN guest_phone text,
  ADD COLUMN invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT attendance_user_or_guest_chk
    CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL OR guest_phone IS NOT NULL);

-- Replace old unique (work_id,user_id,checked_in_at) — too narrow for guests/dates
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_work_id_user_id_checked_in_at_key;
CREATE UNIQUE INDEX attendance_user_unique ON public.attendance(work_id, occurrence_date, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX attendance_email_unique ON public.attendance(work_id, occurrence_date, guest_email)
  WHERE guest_email IS NOT NULL AND user_id IS NULL;
CREATE UNIQUE INDEX attendance_phone_unique ON public.attendance(work_id, occurrence_date, guest_phone)
  WHERE guest_phone IS NOT NULL AND user_id IS NULL AND guest_email IS NULL;
CREATE INDEX attendance_invited_user_idx ON public.attendance(invited_user_id) WHERE invited_user_id IS NOT NULL;

-- Extend attendance policies: responsibles + read own
DROP POLICY IF EXISTS "attendance manage" ON public.attendance;
DROP POLICY IF EXISTS "attendance read own or manager" ON public.attendance;
CREATE POLICY "attendance manage" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id))
  WITH CHECK (public.has_permission(auth.uid(), 'work.manage') OR public.is_work_responsible(auth.uid(), work_id));
CREATE POLICY "attendance read own or manager" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'work.manage')
    OR public.is_work_responsible(auth.uid(), work_id)
  );

-- ============================================================
-- 4. Pending invites (guests sem conta)
-- ============================================================
CREATE TABLE public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  email text,
  phone text,
  full_name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX pending_invites_email_idx ON public.pending_invites(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX pending_invites_phone_idx ON public.pending_invites(phone) WHERE phone IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_invites TO authenticated;
GRANT ALL ON public.pending_invites TO service_role;
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi manage" ON public.pending_invites
  FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'work.manage')
    OR (work_id IS NOT NULL AND public.is_work_responsible(auth.uid(), work_id))
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'work.manage')
    OR (work_id IS NOT NULL AND public.is_work_responsible(auth.uid(), work_id))
  );

-- ============================================================
-- 5. Audios: optional structured entity link + responsibles in policies
-- ============================================================
ALTER TABLE public.audios
  ADD COLUMN message_entity_id uuid REFERENCES public.channeling_entities(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "audios uploader update own" ON public.audios;
CREATE POLICY "audios uploader update own" ON public.audios
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_permission(auth.uid(), 'audio.edit_any')
    OR (work_id IS NOT NULL AND public.is_work_responsible(auth.uid(), work_id))
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR public.has_permission(auth.uid(), 'audio.edit_any')
    OR (work_id IS NOT NULL AND public.is_work_responsible(auth.uid(), work_id))
  );

-- ============================================================
-- 6. handle_new_user: link pending invites pelo e-mail
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_role_id UUID;
  is_first_user BOOLEAN;
  inv RECORD;
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

  -- Link pending invites by email and back-fill attendance.invited_user_id
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
