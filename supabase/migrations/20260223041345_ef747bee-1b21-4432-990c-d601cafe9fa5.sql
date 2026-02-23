
-- Add approved_pe_number to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS approved_pe_number text DEFAULT '';

-- Extend app_role enum with accountant and finance roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
