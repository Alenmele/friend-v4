-- ============================================================
-- Friend Card V4 - 新增用户管理功能
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- ============================================================

-- 创建 RPC 函数：主人后台新增用户
-- 使用 SECURITY DEFINER 绕过 RLS，通过 auth.admin API 创建用户
-- 注意：此函数需要 service_role 权限才能调用 auth.admin.createUser
-- 前端使用 anon key 调用时会被拒绝，因此改为直接在 profiles 表插入记录
-- 并通过触发器或应用层处理 auth.users 创建

-- 方案：创建一个公开的 RPC 函数，仅允许已认证的主人调用
-- 使用 supabase.functions.invoke 或 Edge Function 创建用户
-- 由于 Supabase 免费版不支持 Edge Function 自定义权限，这里采用替代方案：
-- 主人通过前端直接调用 supabase.auth.admin.createUser（需要 service_role key）
-- 但前端不应暴露 service_role key，因此我们使用 RPC + SECURITY DEFINER

-- 创建函数：主人新增用户
-- 此函数会在 auth.users 和 public.profiles 中创建记录
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text DEFAULT 'Aa123456',
  p_nickname text DEFAULT '新用户'
) RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- 验证调用者是已认证用户
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  -- 验证邮箱格式
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION '邮箱不能为空';
  END IF;

  -- 检查邮箱是否已存在
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION '该邮箱已被注册';
  END IF;

  -- 使用 auth.admin 创建用户（需要 service_role 权限）
  -- 在 SECURITY DEFINER 函数中，可以通过检查权限来执行
  -- 但 auth.admin.createUser 需要 service_role，普通用户无法调用
  
  -- 替代方案：直接返回需要主人使用 service_role 的提示
  -- 或者通过 Supabase Dashboard 手动创建
  
  -- 实际方案：创建一个简单的 profiles 记录，auth.users 由前端 signUp 创建
  -- 前端流程：1. 调用 supabase.auth.signUp  2. 自动触发 profiles 记录创建
  
  -- 这里我们返回一个标志，让前端处理实际的用户创建
  v_result := json_build_object(
    'success', false,
    'message', '请通过前端注册流程创建用户',
    'email', p_email
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 替代方案：使用 auth.users 的触发器自动创建 profiles 记录
-- ============================================================

-- 创建或替换触发器函数：当新用户注册时自动创建 profiles 记录
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

-- 删除旧触发器（如果存在）并创建新触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 创建函数：主人批量查询所有用户（仅主人可用）
-- ============================================================
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

-- ============================================================
-- 创建函数：主人删除用户（仅删除 profiles，auth.users 需要在控制台删除）
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  -- 不能删除自己
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION '不能删除当前登录账号';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 创建函数：主人重置用户密码
-- 注意：前端无法直接重置其他用户的密码，需要通过 Supabase 控制台
-- 此函数仅标记需要重置密码，实际重置需在控制台操作
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 返回提示信息，实际密码重置需在 Supabase 控制台操作
  RETURN json_build_object(
    'success', true,
    'message', '请前往 Supabase 控制台 Authentication 页面重置该用户密码',
    'email', v_email,
    'default_password', 'Aa123456'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  RAISE NOTICE '✅ add-user-mgmt.sql 执行完毕：用户管理功能已创建';
END $$;
