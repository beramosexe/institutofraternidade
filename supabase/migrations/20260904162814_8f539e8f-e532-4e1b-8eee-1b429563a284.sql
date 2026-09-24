-- 1) Scope creator-management policies to authenticated only
DO $
BEGIN
  IF to_regclass('public.communications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Gerenciamento de comunicados pelo criador" ON public.communications;
    CREATE POLICY "Gerenciamento de comunicados pelo criador"
      ON public.communications FOR ALL TO authenticated
      USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  END IF;
END $;

DO $
BEGIN
  IF to_regclass('public.site_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Autores gerenciam seus próprios posts no site" ON public.site_posts;
    CREATE POLICY "Autores gerenciam seus próprios posts no site"
      ON public.site_posts FOR ALL TO authenticated
      USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
  END IF;
END $;

DO $
BEGIN
  IF to_regclass('public.social_media_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Gerenciamento de agendamentos sociais pelo criador" ON public.social_media_posts;
    CREATE POLICY "Gerenciamento de agendamentos sociais pelo criador"
      ON public.social_media_posts FOR ALL TO authenticated
      USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  END IF;
END $;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions that no client role should call
REVOKE EXECUTE ON FUNCTION public.is_work_responsible(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_audio_play(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_display(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_classes(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role_slug(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_associate(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.was_active_at(uuid, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_permission(app_permission, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_critical_permission(app_permission) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.role_has_critical_permission(uuid) FROM anon, authenticated;