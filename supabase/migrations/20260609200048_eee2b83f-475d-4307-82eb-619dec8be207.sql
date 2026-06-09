GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role_slug(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_associate(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_audio(uuid, uuid) TO authenticated, anon;