
-- ============ CONTRACTS TABLE ============

-- Drop old Accountant/Finance UPDATE policies (too permissive)
DROP POLICY IF EXISTS "Accountants can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Finance can update contracts" ON public.contracts;

-- Accountant: can only update contracts they created
CREATE POLICY "Accountants can update own contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role) AND created_by = auth.uid());

-- Finance: can only update contracts they created
CREATE POLICY "Finance can update own contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'finance'::app_role) AND created_by = auth.uid());

-- Accountant: can view ALL contracts
CREATE POLICY "Accountants can view all contracts"
ON public.contracts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Finance: can view ALL contracts
CREATE POLICY "Finance can view all contracts"
ON public.contracts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'finance'::app_role));

-- ============ REVIEW_REQUESTS TABLE ============

-- Drop old Manager SELECT policy (too permissive - no department filter)
DROP POLICY IF EXISTS "Managers can view review_requests" ON public.review_requests;

-- Manager: can only view review_requests from their department
CREATE POLICY "Managers can view department review_requests"
ON public.review_requests FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND department = (SELECT p.department FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
);

-- Drop old Manager UPDATE policy (managers should not update)
DROP POLICY IF EXISTS "Managers can update review_requests" ON public.review_requests;
