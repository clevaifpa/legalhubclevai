-- Add reply / edit / delete tracking columns
ALTER TABLE public.review_request_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_rrm_request_created
  ON public.review_request_messages (request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rrm_reply_to
  ON public.review_request_messages (reply_to_message_id);

-- Update chat access function: allow user if they are sender of a message in this request that someone has replied to (covers reply-target visibility),
-- and keep all existing rules.
CREATE OR REPLACE FUNCTION public.can_access_review_request_chat(_req_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'accountant')
    OR public.has_role(_user_id, 'finance')
    OR public.has_role(_user_id, 'manager_chung')
    OR EXISTS (
      SELECT 1 FROM public.review_requests r
      WHERE r.id = _req_id
        AND _user_id IN (
          r.requester_id, r.manager_id, r.global_manager_id,
          r.legal_reviewer_id, r.accountant_reviewer_id, r.finance_reviewer_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.review_request_message_viewers v
      WHERE v.request_id = _req_id AND v.user_id = _user_id
    )
    -- Sender of any message in this request can always see the thread (covers replies)
    OR EXISTS (
      SELECT 1 FROM public.review_request_messages m
      WHERE m.request_id = _req_id AND m.sender_id = _user_id
    );
$function$;

-- Tighten UPDATE policy: sender can edit own; admin can soft-delete any (still via update)
DROP POLICY IF EXISTS "Chat: sender or admin can update" ON public.review_request_messages;
CREATE POLICY "Chat: sender or admin can update"
ON public.review_request_messages
FOR UPDATE
TO authenticated
USING ((sender_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((sender_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
