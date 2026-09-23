-- Public associate signups are intentionally pending and must not receive a role
-- before manual validation. Existing accounts are not changed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'associate_signup' THEN
    UPDATE public.profiles
    SET membership_status = 'pending'
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

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
