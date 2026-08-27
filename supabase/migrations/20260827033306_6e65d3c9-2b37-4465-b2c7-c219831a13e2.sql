-- 1) Novas permissões
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'maintenance.request';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'maintenance.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'purchase.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'finance.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'finance.approve';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'media.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'options.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'record.delete';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'notification.manage';

-- 2) Cargo de sistema: Gestão de Associados
INSERT INTO public.roles (slug, name, description, is_system)
VALUES ('membros', 'Gestão de Associados',
        'Valida cadastros, configura contas, administra turmas, níveis e funções não críticas.', true)
ON CONFLICT (slug) DO NOTHING;

-- 3) Helper de criticidade
CREATE OR REPLACE FUNCTION public.is_critical_permission(_permission app_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.critical_permissions WHERE permission = _permission);
$$;

CREATE OR REPLACE FUNCTION public.role_has_critical_permission(_role_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.critical_permissions cp ON cp.permission = rp.permission
    WHERE rp.role_id = _role_id
  ) OR EXISTS (
    SELECT 1 FROM public.roles r WHERE r.id = _role_id AND r.slug = 'admin'
  );
$$;

-- 4) Somente administração concede/remove permissão crítica
CREATE OR REPLACE FUNCTION public.guard_critical_role_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  perm app_permission := coalesce(NEW.permission, OLD.permission);
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.is_critical_permission(perm)
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão crítica: somente a administração pode alterar "%".', perm;
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_role_permissions_guard ON public.role_permissions;
CREATE TRIGGER tg_role_permissions_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.guard_critical_role_permission();

-- 5) Atribuição de cargos: crítico só pela administração; ninguém se autoatribui
CREATE OR REPLACE FUNCTION public.guard_user_role_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rid uuid := coalesce(NEW.role_id, OLD.role_id);
  target uuid := coalesce(NEW.user_id, OLD.user_id);
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF NOT public.is_admin(actor) THEN
    IF public.role_has_critical_permission(rid) THEN
      RAISE EXCEPTION 'Este cargo concede permissões críticas e só pode ser atribuído pela administração.';
    END IF;
    IF target = actor THEN
      RAISE EXCEPTION 'Não é permitido alterar os próprios cargos.';
    END IF;
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_user_roles_guard ON public.user_roles;
CREATE TRIGGER tg_user_roles_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_assignment();

-- 6) Auditoria automática
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ent text := TG_TABLE_NAME;
  eid uuid;
  d jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    d := jsonb_build_object('before', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    d := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    d := jsonb_build_object('after', to_jsonb(NEW));
  END IF;

  BEGIN
    eid := (coalesce(d->'after', d->'before')->>'id')::uuid;
  EXCEPTION WHEN others THEN
    eid := NULL;
  END;
  IF eid IS NULL THEN
    BEGIN
      eid := (coalesce(d->'after', d->'before')->>'user_id')::uuid;
    EXCEPTION WHEN others THEN eid := NULL;
    END;
  END IF;

  INSERT INTO public.audit_logs (actor_id, entity, entity_id, action, diff)
  VALUES (auth.uid(), ent, eid, lower(TG_OP), d);

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER tg_audit_role_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS tg_audit_user_roles ON public.user_roles;
CREATE TRIGGER tg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS tg_audit_roles ON public.roles;
CREATE TRIGGER tg_audit_roles
AFTER INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS tg_audit_msp ON public.member_status_periods;
CREATE TRIGGER tg_audit_msp
AFTER INSERT OR UPDATE OR DELETE ON public.member_status_periods
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS tg_audit_class_members ON public.class_members;
CREATE TRIGGER tg_audit_class_members
AFTER INSERT OR UPDATE OR DELETE ON public.class_members
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE OR REPLACE FUNCTION public.audit_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    INSERT INTO public.audit_logs (actor_id, entity, entity_id, action, diff)
    VALUES (auth.uid(), 'profiles', NEW.id, 'membership_status',
            jsonb_build_object('before', OLD.membership_status, 'after', NEW.membership_status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_profile_membership ON public.profiles;
CREATE TRIGGER tg_audit_profile_membership
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_membership();