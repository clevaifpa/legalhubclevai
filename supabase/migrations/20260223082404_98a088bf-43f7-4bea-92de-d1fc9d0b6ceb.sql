
-- Add legal_review_doc_link to review_requests
ALTER TABLE public.review_requests ADD COLUMN IF NOT EXISTS legal_review_doc_link text DEFAULT NULL;

-- Add department column to review_requests (ensure it's used for dropdown)
-- Already exists, no change needed

-- Create payment_schedules table
CREATE TABLE public.payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id uuid REFERENCES public.review_requests(id) ON DELETE CASCADE NOT NULL,
  phase_name text NOT NULL,
  payment_amount bigint NOT NULL DEFAULT 0,
  payment_due_date date DEFAULT NULL,
  payment_status text NOT NULL DEFAULT 'chua_thanh_toan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage payment_schedules"
ON public.payment_schedules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can view their own (via review_requests)
CREATE POLICY "Users can view own payment_schedules"
ON public.payment_schedules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.review_requests
  WHERE review_requests.id = payment_schedules.review_request_id
    AND review_requests.requester_id = auth.uid()
));

-- RLS: Users can insert payment schedules for their own requests
CREATE POLICY "Users can insert own payment_schedules"
ON public.payment_schedules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.review_requests
  WHERE review_requests.id = payment_schedules.review_request_id
    AND review_requests.requester_id = auth.uid()
));

-- RLS: Users can delete own pending payment schedules
CREATE POLICY "Users can delete own payment_schedules"
ON public.payment_schedules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.review_requests
  WHERE review_requests.id = payment_schedules.review_request_id
    AND review_requests.requester_id = auth.uid()
));

-- Add new contract status: da_thanh_ly
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'da_thanh_ly';

-- Also create payment_schedules for contracts (contract-level)
CREATE TABLE public.contract_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  phase_name text NOT NULL,
  payment_amount bigint NOT NULL DEFAULT 0,
  payment_due_date date DEFAULT NULL,
  payment_status text NOT NULL DEFAULT 'chua_thanh_toan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract_payment_schedules"
ON public.contract_payment_schedules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view contract_payment_schedules"
ON public.contract_payment_schedules FOR SELECT
USING (true);

-- Enable realtime for payment_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_payment_schedules;
