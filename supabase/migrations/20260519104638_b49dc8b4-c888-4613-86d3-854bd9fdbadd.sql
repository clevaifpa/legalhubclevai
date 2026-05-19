
CREATE TABLE public.review_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  sender_role text,
  sender_department text,
  message text NOT NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_request_messages_message_not_empty CHECK (length(btrim(message)) > 0)
);

CREATE INDEX idx_review_request_messages_request ON public.review_request_messages(request_id, created_at);

CREATE TABLE public.review_request_message_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

CREATE INDEX idx_review_request_message_viewers_user ON public.review_request_message_viewers(user_id, request_id);

ALTER TABLE public.review_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_request_message_viewers ENABLE ROW LEVEL SECURITY;

-- Helper function: who can read/write chat for a given request
CREATE OR REPLACE FUNCTION public.can_access_review_request_chat(_req_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin, accountant, finance, manager_chung: full access
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'accountant')
    OR public.has_role(_user_id, 'finance')
    OR public.has_role(_user_id, 'manager_chung')
    -- Parties in the review flow
    OR EXISTS (
      SELECT 1 FROM public.review_requests r
      WHERE r.id = _req_id
        AND _user_id IN (
          r.requester_id, r.manager_id, r.global_manager_id,
          r.legal_reviewer_id, r.accountant_reviewer_id, r.finance_reviewer_id
        )
    )
    -- Tagged viewers
    OR EXISTS (
      SELECT 1 FROM public.review_request_message_viewers v
      WHERE v.request_id = _req_id AND v.user_id = _user_id
    );
$$;

-- Policies: messages
CREATE POLICY "Chat: view if allowed"
ON public.review_request_messages
FOR SELECT TO authenticated
USING (is_deleted = false AND public.can_access_review_request_chat(request_id, auth.uid()));

CREATE POLICY "Chat: send if allowed"
ON public.review_request_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.can_access_review_request_chat(request_id, auth.uid()));

CREATE POLICY "Chat: sender or admin can update"
ON public.review_request_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policies: viewers
CREATE POLICY "Viewers: select if allowed"
ON public.review_request_message_viewers
FOR SELECT TO authenticated
USING (public.can_access_review_request_chat(request_id, auth.uid()));

CREATE POLICY "Viewers: grant if can access"
ON public.review_request_message_viewers
FOR INSERT TO authenticated
WITH CHECK (public.can_access_review_request_chat(request_id, auth.uid()));

CREATE POLICY "Viewers: admin manage"
ON public.review_request_message_viewers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_review_request_messages_updated_at
BEFORE UPDATE ON public.review_request_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.review_request_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_request_messages;
