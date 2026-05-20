
-- Helper RPC: can a user view a review request (read-only access scope)
CREATE OR REPLACE FUNCTION public.can_view_review_request(_req_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'accountant')
    OR public.has_role(_user_id, 'finance')
    OR public.has_role(_user_id, 'manager_chung')
    OR EXISTS (
      SELECT 1 FROM public.review_requests r
      WHERE r.id = _req_id
        AND (
          r.requester_id = _user_id
          OR r.manager_id = _user_id
          OR r.global_manager_id = _user_id
          OR r.legal_reviewer_id = _user_id
          OR r.accountant_reviewer_id = _user_id
          OR r.finance_reviewer_id = _user_id
          OR (
            public.has_role(_user_id, 'manager')
            AND r.department = (SELECT department FROM public.profiles WHERE user_id = _user_id LIMIT 1)
          )
        )
    );
$$;

-- Attachments table for review request (description) and internal chat messages
CREATE TABLE public.review_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id uuid NOT NULL,
  message_id uuid NULL,
  attachment_type text NOT NULL CHECK (attachment_type IN ('image','file','folder')),
  file_url text NOT NULL,
  storage_path text NULL,
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  file_size bigint NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_attachments_request ON public.review_attachments(review_request_id);
CREATE INDEX idx_review_attachments_message ON public.review_attachments(message_id);

ALTER TABLE public.review_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: message-level uses chat access; description-level uses request view access
CREATE POLICY "Attachments: view if allowed"
ON public.review_attachments
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN message_id IS NOT NULL THEN public.can_access_review_request_chat(review_request_id, auth.uid())
    ELSE public.can_view_review_request(review_request_id, auth.uid())
  END
);

-- INSERT: must be own row; message-level requires chat access; description-level requires requester or admin
CREATE POLICY "Attachments: insert if allowed"
ON public.review_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    CASE
      WHEN message_id IS NOT NULL THEN public.can_access_review_request_chat(review_request_id, auth.uid())
      ELSE (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.review_requests r
          WHERE r.id = review_request_id AND r.requester_id = auth.uid()
        )
      )
    END
  )
);

-- DELETE: owner or admin
CREATE POLICY "Attachments: delete by owner or admin"
ON public.review_attachments
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_attachments;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('review-attachments', 'review-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated user who can view the request can read/write under <req_id>/...
CREATE POLICY "review-attachments read if can view request"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'review-attachments'
  AND (
    (storage.foldername(name))[1] = '_drafts'
      AND (storage.foldername(name))[2] = auth.uid()::text
  )
  OR (
    bucket_id = 'review-attachments'
    AND public.can_view_review_request(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "review-attachments insert if can view request"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-attachments'
  AND (
    (
      (storage.foldername(name))[1] = '_drafts'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR public.can_view_review_request(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "review-attachments delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'review-attachments'
  AND owner = auth.uid()
);
