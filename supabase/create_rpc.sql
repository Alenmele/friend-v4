DROP FUNCTION IF EXISTS admin_create_profile CASCADE;

CREATE FUNCTION admin_create_profile(
  p_user_id UUID,
  p_email TEXT,
  p_nickname TEXT DEFAULT '新用户',
  p_is_admin BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RETURN json_build_object('success', false, 'error', '无管理员权限');
  END IF;

  INSERT INTO profiles (id, email, nickname, is_admin, created_at, updated_at)
  VALUES (p_user_id, p_email, p_nickname, p_is_admin, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nickname = EXCLUDED.nickname,
    is_admin = EXCLUDED.is_admin,
    updated_at = NOW();

  RETURN json_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_profile TO authenticated;
