-- communications
DO $
BEGIN
  IF to_regclass('public.communications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Leitura de comunicados por autenticados" ON public.communications;
    CREATE POLICY "communications_read_staff" ON public.communications
    FOR SELECT TO authenticated
    USING (
      created_by = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'media.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'notification.manage'::app_permission)
    );
  END IF;
END $;

-- social_media_posts
DO $
BEGIN
  IF to_regclass('public.social_media_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Leitura de agendamentos sociais por autenticados" ON public.social_media_posts;
    CREATE POLICY "social_posts_read_staff" ON public.social_media_posts
    FOR SELECT TO authenticated
    USING (
      created_by = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'media.manage'::app_permission)
    );
  END IF;
END $;

-- maintenance_quotes
DROP POLICY IF EXISTS "mq_read" ON public.maintenance_quotes;
CREATE POLICY "mq_read" ON public.maintenance_quotes
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.maintenance_tickets t
  WHERE t.id = maintenance_quotes.ticket_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'maintenance.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'finance.view'::app_permission)
    )
));

-- maintenance_ticket_events
DROP POLICY IF EXISTS "mte_read" ON public.maintenance_ticket_events;
CREATE POLICY "mte_read" ON public.maintenance_ticket_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.maintenance_tickets t
  WHERE t.id = maintenance_ticket_events.ticket_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'maintenance.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'finance.view'::app_permission)
    )
));

-- purchase_documents
DROP POLICY IF EXISTS "pd_read" ON public.purchase_documents;
CREATE POLICY "pd_read" ON public.purchase_documents
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'purchase.manage'::app_permission)
  OR public.has_permission(auth.uid(), 'stock.manage'::app_permission)
  OR public.has_permission(auth.uid(), 'finance.view'::app_permission)
);

-- purchase_items
DROP POLICY IF EXISTS "pi_read" ON public.purchase_items;
CREATE POLICY "pi_read" ON public.purchase_items
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'purchase.manage'::app_permission)
  OR public.has_permission(auth.uid(), 'stock.manage'::app_permission)
  OR public.has_permission(auth.uid(), 'finance.view'::app_permission)
);

-- purchase_request_items
DROP POLICY IF EXISTS "pri_read" ON public.purchase_request_items;
CREATE POLICY "pri_read" ON public.purchase_request_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_requests r
  WHERE r.id = purchase_request_items.request_id
    AND (
      r.requested_by = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'purchase.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'stock.manage'::app_permission)
      OR public.has_permission(auth.uid(), 'finance.view'::app_permission)
    )
));

-- site_posts: public only sees published
DO $
BEGIN
  IF to_regclass('public.site_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Leitura pública de posts do site" ON public.site_posts;
    CREATE POLICY "site_posts_public_read_published" ON public.site_posts
    FOR SELECT TO anon, authenticated
    USING (
      (status = 'published' AND published_at IS NOT NULL AND published_at <= now())
      OR author_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'media.manage'::app_permission)
    );
  END IF;
END $;

-- Trigger functions never need EXECUTE grants
REVOKE ALL ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helpers only needed by signed-in users
REVOKE ALL ON FUNCTION public.can_manage_classes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.was_active_at(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role_slug(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_associate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_work_responsible(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_audio_play(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_audio(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(uuid, app_permission) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;

-- Ensure the grants still needed by RLS policies exist
GRANT EXECUTE ON FUNCTION public.can_manage_classes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.was_active_at(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_slug(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_associate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_work_responsible(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_audio_play(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_audio(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;