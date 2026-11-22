DROP POLICY IF EXISTS "campaign_photos_read" ON storage.objects;

CREATE POLICY "campaign_photos_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
);