-- Manager_chung can view all contracts
CREATE POLICY "Manager_chung can view all contracts"
ON public.contracts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role));

-- Manager_chung can insert contracts
CREATE POLICY "Manager_chung can insert contracts"
ON public.contracts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager_chung'::app_role));

-- Manager_chung can update own contracts
CREATE POLICY "Manager_chung can update own contracts"
ON public.contracts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role) AND created_by = auth.uid());

-- Manager_chung can delete own contracts  
CREATE POLICY "Manager_chung can delete own contracts"
ON public.contracts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role) AND created_by = auth.uid());

-- Manager_chung can manage contract_payment_schedules
CREATE POLICY "Manager_chung can manage contract_payment_schedules"
ON public.contract_payment_schedules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role));

-- Manager_chung can insert categories (add contract types)
CREATE POLICY "Manager_chung can insert categories"
ON public.contract_categories FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager_chung'::app_role));