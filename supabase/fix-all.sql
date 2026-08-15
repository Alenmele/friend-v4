-- ============================================================
-- Friend Card V4 - 关闭邮箱验证 + 修复保存功能
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- ============================================================

-- ========== 1. 关闭邮箱验证 ==========

-- 自动确认所有现有用户的邮箱
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  email_confirmed = true
WHERE email_confirmed_at IS NULL OR confirmed_at IS NULL;

-- ========== 2. 重新创建保存资料的 RPC 函数 ==========

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.update_owner_profile(text, text, integer, text, text, text, text[], text);

-- 重新创建：保存主人资料
CREATE OR REPLACE FUNCTION public.update_owner_profile(
  p_nickname text,
  p_gender text,
  p_age integer,
  p_wechat text,
  p_bio text DEFAULT '',
  p_expectation text DEFAULT '',
  p_photos text[] DEFAULT '{}',
  p_avatar text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  -- 参数校验
  IF p_gender NOT IN ('男', '女') THEN
    RAISE EXCEPTION '性别参数非法，仅支持 男/女';
  END IF;
  IF p_age < 18 OR p_age > 120 THEN
    RAISE EXCEPTION '年龄必须在 18-120 之间';
  END IF;
  IF p_nickname IS NULL OR length(trim(p_nickname)) = 0 THEN
    RAISE EXCEPTION '昵称不能为空';
  END IF;

  UPDATE public.profiles
  SET
    nickname = p_nickname,
    gender = p_gender,
    age = p_age,
    wechat = p_wechat,
    bio = p_bio,
    expectation = p_expectation,
    photos = p_photos,
    avatar = COALESCE(p_avatar, CASE WHEN array_length(p_photos, 1) IS NOT NULL AND array_length(p_photos, 1) > 0 THEN p_photos[1] ELSE NULL END),
    updated_at = NOW()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '档案不存在，请先初始化';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予 authenticated 角色执行权限
GRANT EXECUTE ON FUNCTION public.update_owner_profile TO authenticated;

-- ========== 3. 重新创建切换链接开关函数 ==========

DROP FUNCTION IF EXISTS public.toggle_link_active(boolean);

CREATE OR REPLACE FUNCTION public.toggle_link_active(p_active boolean)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  UPDATE public.profiles
  SET link_active = p_active, updated_at = NOW()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '档案不存在';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.toggle_link_active TO authenticated;

-- ========== 4. 确保 RLS 策略正确 ==========

-- 确保 profiles 表 RLS 已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_delete" ON public.profiles;

-- 重建策略
CREATE POLICY "profiles_public_select" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "profiles_owner_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_owner_delete" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- ========== 5. 确保用户管理函数存在 ==========

DROP FUNCTION IF EXISTS public.get_all_users();
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'email', p.email,
      'nickname', p.nickname,
      'gender', p.gender,
      'age', p.age,
      'wechat', p.wechat,
      'link_id', p.link_id,
      'link_active', p.link_active,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    )
  ) INTO v_result
  FROM public.profiles p;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_all_users TO authenticated;

-- ========== 6. 用户删除函数 ==========
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION '不能删除当前登录账号';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;

-- ========== 7. 新用户注册触发器 ==========

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, gender, age, wechat, bio, expectation)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '新用户'),
    '男',
    18,
    '待填写',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$ BEGIN
  RAISE NOTICE '✅ fix-all.sql 执行完毕';
END $$;
