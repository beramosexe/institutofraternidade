
-- 1) Restrict profiles SELECT (hide phone numbers from other users)
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;

CREATE POLICY "profiles read own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- Non-sensitive public view for display lookups (name + avatar only)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

-- Allow read via a SECURITY DEFINER function (bypasses the row policy for safe columns only)
CREATE OR REPLACE FUNCTION public.get_profile_display(_user_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, avatar_url FROM public.profiles WHERE id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.get_profile_display(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_display(uuid) TO authenticated;

-- 2) Remove direct audit_logs insert from authenticated users
DROP POLICY IF EXISTS "audit insert authenticated" ON public.audit_logs;
-- (No new INSERT policy: only service_role / SECURITY DEFINER code can write)

-- 3) Rewrite audios storage read policy to mirror can_access_audio
DROP POLICY IF EXISTS "audios storage read own" ON storage.objects;

CREATE POLICY "audios storage read via can_access_audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audios'
  AND EXISTS (
    SELECT 1 FROM public.audios a
    WHERE a.storage_path = storage.objects.name
      AND public.can_access_audio(a.id, auth.uid())
  )
);

-- Also allow anon to read public-access audio files
CREATE POLICY "audios storage read public"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'audios'
  AND EXISTS (
    SELECT 1 FROM public.audios a
    WHERE a.storage_path = storage.objects.name
      AND a.access_level = 'public'
      AND a.status = 'ready'
  )
);

-- 4) Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated/public
-- They are only needed inside RLS policy expressions, which run with definer rights.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_associate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role_slug(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_audio(uuid, uuid) FROM PUBLIC, anon, authenticated;
