DROP POLICY IF EXISTS "Chat: view if allowed" ON public.review_request_messages;
CREATE POLICY "Chat: view if allowed"
ON public.review_request_messages
FOR SELECT
TO authenticated
USING (public.can_access_review_request_chat(request_id, auth.uid()));
