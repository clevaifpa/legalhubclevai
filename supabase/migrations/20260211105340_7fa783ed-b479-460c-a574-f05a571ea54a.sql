
-- Enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.priority_level AS ENUM ('cao', 'trung_binh', 'thap');
CREATE TYPE public.review_request_status AS ENUM ('cho_xu_ly', 'dang_review', 'da_hoan_thanh', 'yeu_cau_chinh_sua', 'tu_choi');
CREATE TYPE public.contract_type AS ENUM ('mua_ban', 'dich_vu', 'nda', 'hop_tac', 'lao_dong', 'thue', 'khac');
CREATE TYPE public.risk_level AS ENUM ('thap', 'trung_binh', 'cao');
CREATE TYPE public.contract_status AS ENUM ('nhap', 'dang_review', 'da_ky', 'het_hieu_luc');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clauses table
CREATE TABLE public.clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  contract_type contract_type NOT NULL,
  risk_level risk_level NOT NULL DEFAULT 'thap',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contract categories (admin can create new types)
CREATE TABLE public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.contract_categories(id),
  contract_type contract_type NOT NULL DEFAULT 'khac',
  partner_name TEXT NOT NULL DEFAULT '',
  status contract_status NOT NULL DEFAULT 'nhap',
  effective_date DATE,
  expiry_date DATE,
  value BIGINT DEFAULT 0,
  risk_level risk_level NOT NULL DEFAULT 'thap',
  file_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Review requests table
CREATE TABLE public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) NOT NULL,
  priority priority_level NOT NULL DEFAULT 'trung_binh',
  requester_name TEXT NOT NULL,
  department TEXT NOT NULL,
  request_deadline DATE NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  review_deadline DATE,
  contract_title TEXT NOT NULL,
  partner_name TEXT NOT NULL DEFAULT '',
  contract_value BIGINT DEFAULT 0,
  file_url TEXT,
  description TEXT DEFAULT '',
  status review_request_status NOT NULL DEFAULT 'cho_xu_ly',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Review notes
CREATE TABLE public.review_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID REFERENCES public.review_requests(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clauses_updated_at BEFORE UPDATE ON public.clauses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_review_requests_updated_at BEFORE UPDATE ON public.review_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_notes ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User roles: users can read own, admins read all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Clauses: admins full access, users read only
CREATE POLICY "Anyone can view clauses" ON public.clauses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage clauses" ON public.clauses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Contract categories: admins manage, all authenticated can view
CREATE POLICY "Anyone can view categories" ON public.contract_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.contract_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Contracts: admins full access
CREATE POLICY "Admins can manage contracts" ON public.contracts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);

-- Review requests: users see own, admins see all
CREATE POLICY "Users can view own requests" ON public.review_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Users can create requests" ON public.review_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Admins can view all requests" ON public.review_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update requests" ON public.review_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Review notes: visible to request owner and admins
CREATE POLICY "Request owner can view notes" ON public.review_notes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.review_requests WHERE id = review_request_id AND requester_id = auth.uid())
);
CREATE POLICY "Admins can manage notes" ON public.review_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
CREATE POLICY "Authenticated users can upload contracts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts');
CREATE POLICY "Authenticated users can view contracts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts');
CREATE POLICY "Admins can delete contracts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

-- Seed default contract categories
INSERT INTO public.contract_categories (name, description) VALUES
  ('Hợp đồng đối tác', 'Các hợp đồng với đối tác kinh doanh'),
  ('Hợp đồng văn phòng', 'Các hợp đồng liên quan đến văn phòng, thuê mặt bằng'),
  ('Hợp đồng lao động', 'Các hợp đồng lao động với nhân viên'),
  ('Hợp đồng dịch vụ', 'Các hợp đồng dịch vụ với nhà cung cấp');
