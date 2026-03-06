-- Recover admin privileges for linhnt2@clevai.edu.vn
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'linhnt2@clevai.edu.vn';
  
  IF v_user_id IS NOT NULL THEN
    -- Make sure profile exists so they don't even need the recovery RPC if they just login
    INSERT INTO public.profiles (user_id, email, full_name, department)
    VALUES (v_user_id, 'linhnt2@clevai.edu.vn', 'Admin LinhNT2', 'LVO')
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

    -- Update or insert role as admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;
END $$;
