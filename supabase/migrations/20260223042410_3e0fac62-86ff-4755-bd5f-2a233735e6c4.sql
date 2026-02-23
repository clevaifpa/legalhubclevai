
-- Allow authenticated users to read files from contracts bucket
CREATE POLICY "Authenticated users can read contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contracts');

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload contract files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow admins to delete contract files
CREATE POLICY "Admins can delete contract files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));
