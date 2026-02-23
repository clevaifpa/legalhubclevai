
-- 1. Add 'manager' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- 2. Add new workflow statuses to review_request_status
ALTER TYPE public.review_request_status ADD VALUE IF NOT EXISTS 'cho_quan_ly';
ALTER TYPE public.review_request_status ADD VALUE IF NOT EXISTS 'cho_phap_che';
ALTER TYPE public.review_request_status ADD VALUE IF NOT EXISTS 'cho_ke_toan';
ALTER TYPE public.review_request_status ADD VALUE IF NOT EXISTS 'cho_tai_chinh';
ALTER TYPE public.review_request_status ADD VALUE IF NOT EXISTS 'hoan_tat';

-- 3. Add new columns to review_requests
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS contract_type_category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_id uuid;

-- 4. Add tax_code to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_code text DEFAULT '';

-- 5. Add department to user_roles (for manager role department mapping)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS department text DEFAULT '';
