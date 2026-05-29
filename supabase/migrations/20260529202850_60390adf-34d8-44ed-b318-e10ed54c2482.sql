
CREATE POLICY "owner updates screenshots"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'screenshots' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'screenshots' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner deletes screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'screenshots' AND (auth.uid())::text = (storage.foldername(name))[1]);
