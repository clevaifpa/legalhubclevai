
-- Add new columns to contracts table for enhanced metadata
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS signed_file_url text,
ADD COLUMN IF NOT EXISTS liquidation_file_url text;

-- Create a function to auto-expire contracts
CREATE OR REPLACE FUNCTION public.auto_expire_contracts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET status = 'het_hieu_luc'
  WHERE status IN ('da_ky', 'dang_review', 'nhap')
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE;
END;
$$;

-- Add RLS policy for users to insert contracts
CREATE POLICY "Authenticated users can insert contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Add RLS policy for admins to delete contracts
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add delete policy for contract_categories
CREATE POLICY "Admins can delete categories"
ON public.contract_categories
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS for review_requests delete by admin
CREATE POLICY "Admins can delete requests"
ON public.review_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to delete their own review requests (only if cho_xu_ly)
CREATE POLICY "Users can delete own pending requests"
ON public.review_requests
FOR DELETE
USING (auth.uid() = requester_id AND status = 'cho_xu_ly');

-- Add file_url upload support for review_requests (already has file_url column)
-- Enable realtime for contracts to support live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_requests;
