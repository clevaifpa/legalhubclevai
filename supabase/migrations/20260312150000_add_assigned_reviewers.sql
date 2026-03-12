-- Add specific reviewer fields to review_requests table
ALTER TABLE public.review_requests
ADD COLUMN legal_reviewer_id UUID REFERENCES auth.users(id),
ADD COLUMN accountant_reviewer_id UUID REFERENCES auth.users(id),
ADD COLUMN finance_reviewer_id UUID REFERENCES auth.users(id);

-- Create a function to get all potential reviewers (admin, manager, accountant, finance) with their full names
CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_names()
RETURNS TABLE(user_id uuid, role text, full_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ur.user_id, ur.role::text, p.full_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'manager', 'accountant', 'finance');
$$;
