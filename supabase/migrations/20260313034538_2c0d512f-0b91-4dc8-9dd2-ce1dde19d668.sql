
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS global_manager_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS legal_reviewer_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accountant_reviewer_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finance_reviewer_id uuid DEFAULT NULL;
