ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS sheet_row_index integer,
ADD COLUMN IF NOT EXISTS sheet_tab_name text,
ADD COLUMN IF NOT EXISTS sheet_entity_name text;

CREATE INDEX IF NOT EXISTS idx_contracts_sheet_mapping
ON public.contracts (sheet_tab_name, sheet_row_index)
WHERE sheet_row_index IS NOT NULL;