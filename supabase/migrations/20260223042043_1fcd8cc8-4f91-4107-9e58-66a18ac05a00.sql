
ALTER TABLE public.review_requests ADD COLUMN IF NOT EXISTS approved_pe_number text DEFAULT '';
