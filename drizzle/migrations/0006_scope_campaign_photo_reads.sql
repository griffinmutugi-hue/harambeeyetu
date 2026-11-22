DROP POLICY IF EXISTS "campaign_photos_read" ON storage.objects;

CREATE POLICY "campaign_photos_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'campaign-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1
      FROM public.campaigns AS campaign
      WHERE campaign.status IN ('active', 'completed')
        AND (
          campaign.cover_photo = name
          OR campaign.organizer_photo = name
        )
    )
  )
);