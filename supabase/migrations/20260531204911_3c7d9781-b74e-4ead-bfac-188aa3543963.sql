-- 1. Resume storage UPDATE: add WITH CHECK mirroring USING
DROP POLICY IF EXISTS "owner updates resumes" ON storage.objects;
CREATE POLICY "owner updates resumes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'resumes' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2. Realtime channel authorization: restrict subscriptions to the user's own channel
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users subscribe to own channel" ON realtime.messages;
CREATE POLICY "users subscribe to own channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || (auth.uid())::text)
);

DROP POLICY IF EXISTS "users broadcast to own channel" ON realtime.messages;
CREATE POLICY "users broadcast to own channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('user:' || (auth.uid())::text)
);