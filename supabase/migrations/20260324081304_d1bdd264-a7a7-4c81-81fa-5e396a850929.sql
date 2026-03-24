
CREATE TABLE public.entity_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL UNIQUE,
  order_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_order ENABLE ROW LEVEL SECURITY;

-- Everyone can read entity order
CREATE POLICY "Anyone can view entity_order" ON public.entity_order FOR SELECT TO authenticated USING (true);

-- Only admins can manage entity order
CREATE POLICY "Admins can manage entity_order" ON public.entity_order FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default order for existing entities
INSERT INTO public.entity_order (entity_name, order_index) VALUES
  ('CHV', 0), ('LKV', 1), ('LKO', 2), ('C2V', 3);
