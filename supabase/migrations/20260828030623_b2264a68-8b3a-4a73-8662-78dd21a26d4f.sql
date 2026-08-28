CREATE POLICY "Gestores podem ver documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'purchase.manage')
    OR public.has_permission(auth.uid(), 'maintenance.manage')
    OR public.has_permission(auth.uid(), 'finance.view')
  )
);

CREATE POLICY "Gestores podem enviar documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'purchase.manage')
    OR public.has_permission(auth.uid(), 'maintenance.manage')
  )
);

CREATE POLICY "Gestores podem remover documentos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'purchase.manage')
    OR public.has_permission(auth.uid(), 'maintenance.manage')
  )
);