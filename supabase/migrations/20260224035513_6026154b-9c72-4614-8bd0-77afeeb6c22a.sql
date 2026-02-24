
-- Allow accountants to update contracts
CREATE POLICY "Accountants can update contracts"
ON public.contracts FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Allow finance to update contracts
CREATE POLICY "Finance can update contracts"
ON public.contracts FOR UPDATE
USING (has_role(auth.uid(), 'finance'::app_role));

-- Allow accountants to insert contracts
CREATE POLICY "Accountants can insert contracts"
ON public.contracts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

-- Allow finance to insert contracts
CREATE POLICY "Finance can insert contracts"
ON public.contracts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'finance'::app_role));

-- Allow accountants to manage contract_payment_schedules
CREATE POLICY "Accountants can manage contract_payment_schedules"
ON public.contract_payment_schedules FOR ALL
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Allow finance to manage contract_payment_schedules
CREATE POLICY "Finance can manage contract_payment_schedules"
ON public.contract_payment_schedules FOR ALL
USING (has_role(auth.uid(), 'finance'::app_role));

-- Allow admin to delete profiles (for employee management)
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
