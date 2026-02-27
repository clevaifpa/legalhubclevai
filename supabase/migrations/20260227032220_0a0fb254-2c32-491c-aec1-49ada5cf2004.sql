
-- Fix 1: Replace overly permissive contracts SELECT policy
DROP POLICY IF EXISTS "Users can view contracts" ON public.contracts;

-- Users see contracts from their own department
CREATE POLICY "Users can view own department contracts"
ON public.contracts FOR SELECT
TO authenticated
USING (
  department = (SELECT department FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Managers can view contracts from their department
CREATE POLICY "Managers can view department contracts"
ON public.contracts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  department = (SELECT department FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Fix 2: Replace overly permissive contract_payment_schedules SELECT policy
DROP POLICY IF EXISTS "Users can view contract_payment_schedules" ON public.contract_payment_schedules;

-- Only admins/accountants/finance can view (already have ALL policies)

-- Fix 3: Replace overly permissive storage policy
DROP POLICY IF EXISTS "Authenticated users can read contract files" ON storage.objects;

CREATE POLICY "Authorized roles can read contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'accountant'::app_role) OR
    public.has_role(auth.uid(), 'finance'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Users can read files they uploaded (their own folder)
CREATE POLICY "Users can read own uploaded contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
