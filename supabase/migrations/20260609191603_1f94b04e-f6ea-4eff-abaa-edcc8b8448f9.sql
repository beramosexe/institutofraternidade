
-- Storage policies for audios bucket
CREATE POLICY "audios storage upload by uploader"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audios'
    AND public.has_permission(auth.uid(), 'audio.upload')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "audios storage read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'audios'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_permission(auth.uid(), 'audio.edit_any')
    )
  );

CREATE POLICY "audios storage delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'audios'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_permission(auth.uid(), 'audio.delete')
    )
  );
