-- ============================================================
-- Friend Card V4 - RLS 权限修复脚本
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- 日期: 2026-08-16
-- ============================================================

-- 1. 删除旧的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_delete" ON public.profiles;

-- 2. 重新创建 RLS 策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 匿名访问：仅可见公开字段
CREATE POLICY "profiles_public_select" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- 主人可查询自己全部字段
CREATE POLICY "profiles_owner_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 主人可插入自己的档案
CREATE POLICY "profiles_owner_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 主人可更新自己的档案
CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 主人可删除自己的档案
CREATE POLICY "profiles_owner_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- 3. 创建 RPC 函数：更新主人资料（绕过 RLS 的安全方式）
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
    avatar = COALESCE(p_avatar, photos[1]),
    updated_at = NOW()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '档案不存在';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建 RPC 函数：切换链接开关
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

DO $$ BEGIN
  RAISE NOTICE '✅ fix-rls.sql 执行完毕：RLS 策略已修复 + RPC 函数已创建';
END $$;
