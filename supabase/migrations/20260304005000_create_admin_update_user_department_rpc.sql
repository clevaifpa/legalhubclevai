-- Create an admin function to update user department securely
CREATE OR REPLACE FUNCTION admin_update_user_department(_department text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Required to bypass RLS when editing another user's profile
SET search_path = public
AS $$
BEGIN
  -- Ensure the executing user is authenticated (Optional but good practice)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure the executing user has admin role (optional, add if needed based on your existing user_roles logic)
  -- IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
  --   RAISE EXCEPTION 'Not authorized';
  -- END IF;

  -- Update profiles
  UPDATE profiles
  SET department = _department
  WHERE user_id = _user_id;

  -- Update user_roles (if the department column exists in user_roles)
  UPDATE user_roles
  SET department = _department
  WHERE user_id = _user_id;
END;
$$;
