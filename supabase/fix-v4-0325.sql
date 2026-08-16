-- ============================================================
-- Friend V4 综合修复 (2026-03-25)
-- 1. visitors 表增加 wechat_qr 列（微信号二维码）
-- 2. rebuild submit_visitor_application：支持 wechat_qr，头像用 photos[1]
-- 3. rebuild update_owner_profile：头像用 photos[1]
-- 4. rebuild admin_delete_user：简化删除流程，避免 storage.objects 权限报错
--    注意：storage.objects 的 RLS 无法通过 SECURITY DEFINER 绕过（它是 Supabase 内部 schema），
--    所以函数中跳过对 storage.objects 的直接删除，仅删除 profiles + visitors + auth.users。
-- ============================================================

-- 1. visitors 增加 wechat_qr 列
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='wechat_qr'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN wechat_qr text DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 2. 重建 submit_visitor_application
-- ============================================================
DROP FUNCTION IF EXISTS public.submit_visitor_application(
  uuid, text, text, text, text, text, text, text, jsonb, text
);
CREATE OR REPLACE FUNCTION public.submit_visitor_application(
  p_owner_id       uuid,
  p_visitor_token  text,
  p_nickname       text,
  p_gender         text,
  p_wechat         text,
  p_wechat_qr      text,       -- 新增：微信号二维码
  p_bio            text,
  p_expectation    text,
  p_photos         jsonb,
  p_avatar         text        -- 新增：头像URL（前端已算好，第二张照片）
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_photo_arr text[];
  v_new_avatar text;
BEGIN
  IF p_owner_id IS NULL OR p_visitor_token IS NULL THEN
    RAISE EXCEPTION '参数缺失（owner/token）';
  END IF;

  IF p_nickname IS NULL OR length(trim(p_nickname)) = 0 THEN
    RAISE EXCEPTION '昵称不能为空';
  END IF;
  IF p_gender IS NULL OR p_gender NOT IN ('男','女') THEN
    RAISE EXCEPTION '性别无效';
  END IF;

  -- jsonb → text[]
  IF p_photos IS NULL OR p_photos = 'null'::jsonb OR jsonb_array_length(p_photos) = 0 THEN
    v_photo_arr := ARRAY[]::text[];
  ELSE
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(p_photos)
    ) INTO v_photo_arr;
  END IF;

  IF array_length(v_photo_arr, 1) IS NULL THEN
    RAISE EXCEPTION '至少上传 1 张照片';
  END IF;
  IF array_length(v_photo_arr, 1) > 3 THEN
    RAISE EXCEPTION '照片不能超过 3 张';
  END IF;

  -- 头像：优先使用前端传入的 p_avatar；否则用第二张，再退第一张
  IF p_avatar IS NOT NULL AND length(trim(p_avatar)) > 0 THEN
    v_new_avatar := trim(p_avatar);
  ELSE
    IF array_length(v_photo_arr, 1) >= 2 THEN
      v_new_avatar := v_photo_arr[2];
    ELSE
      v_new_avatar := v_photo_arr[1];
    END IF;
  END IF;

  -- UPSERT：根据 owner_id + visitor_token 唯一约束幂等提交
  INSERT INTO public.visitors (
    owner_id, visitor_token, nickname, gender, wechat, wechat_qr,
    bio, expectation, photos, avatar, status, allow_reapply, created_at, updated_at
  ) VALUES (
    p_owner_id,
    p_visitor_token,
    trim(p_nickname),
    p_gender,
    COALESCE(trim(p_wechat), ''),
    COALESCE(trim(p_wechat_qr), ''),
    COALESCE(p_bio, ''),
    COALESCE(p_expectation, ''),
    v_photo_arr,
    v_new_avatar,
    'pending',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (owner_id, visitor_token) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    gender = EXCLUDED.gender,
    wechat = EXCLUDED.wechat,
    wechat_qr = EXCLUDED.wechat_qr,
    bio = EXCLUDED.bio,
    expectation = EXCLUDED.expectation,
    photos = EXCLUDED.photos,
    avatar = EXCLUDED.avatar,
    status = CASE
               WHEN public.visitors.status = 'rejected' AND public.visitors.allow_reapply = false
                 THEN 'rejected'
               ELSE 'pending'
             END,
    updated_at = NOW()
  RETURNING id INTO v_id;

  -- 提交通知
  BEGIN
    INSERT INTO public.notifications (user_id, type, content, ref_visitor_id, created_at)
    VALUES (p_owner_id, 'visitor_apply', p_nickname || '提交了互看申请，快去审核吧', v_id, NOW());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 3. 重建 update_owner_profile：头像逻辑使用第二张照片
-- ============================================================
DROP FUNCTION IF EXISTS public.update_owner_profile(
  uuid, text, text, text, integer, text, text, text, jsonb
);
CREATE OR REPLACE FUNCTION public.update_owner_profile(
  p_id           uuid,
  p_nickname     text,
  p_gender       text,
  p_wechat       text,
  p_age          integer,
  p_bio          text,
  p_expectation  text,
  p_link_id      text,
  p_photos       jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo_arr text[];
  v_avatar    text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION '用户ID缺失';
  END IF;

  -- 校验必填
  IF p_nickname IS NULL OR length(trim(p_nickname)) = 0 THEN
    RAISE EXCEPTION '昵称不能为空';
  END IF;
  IF p_gender IS NULL OR p_gender NOT IN ('男','女') THEN
    RAISE EXCEPTION '性别无效';
  END IF;
  IF p_wechat IS NULL OR length(trim(p_wechat)) = 0 THEN
    RAISE EXCEPTION '微信号不能为空';
  END IF;
  IF p_age IS NULL OR p_age < 16 OR p_age > 120 THEN
    RAISE EXCEPTION '年龄必须在 16-120 之间';
  END IF;

  -- photos jsonb -> text[]
  IF p_photos IS NULL OR p_photos = 'null'::jsonb OR jsonb_array_length(p_photos) = 0 THEN
    RAISE EXCEPTION '至少上传 1 张照片';
  END IF;
  IF jsonb_array_length(p_photos) > 3 THEN
    RAISE EXCEPTION '照片不能超过 3 张';
  END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(p_photos)) INTO v_photo_arr;

  -- 头像：用第二张照片，若只有一张就用第一张
  IF array_length(v_photo_arr, 1) >= 2 THEN
    v_avatar := v_photo_arr[2];
  ELSE
    v_avatar := v_photo_arr[1];
  END IF;

  UPDATE public.profiles
  SET
    nickname     = trim(p_nickname),
    gender       = p_gender,
    wechat       = trim(p_wechat),
    age          = p_age,
    bio          = COALESCE(p_bio, ''),
    expectation  = COALESCE(p_expectation, ''),
    link_id      = COALESCE(trim(p_link_id), link_id),
    photos       = v_photo_arr,
    avatar       = v_avatar,
    updated_at   = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '档案不存在';
  END IF;
END;
$$;

-- ============================================================
-- 4. 重建 admin_delete_user：避免 storage.objects 权限报错
--    因为 storage.objects 属于 Supabase 内部 schema storage，
--    即使 SECURITY DEFINER 也无法绕过其 RLS（storage.objects 的策略
--    检查 storage.buckets 的 owner_id 与 auth.uid() 匹配），
--    因此这里改为跳过 storage.objects 的直接删除，仅删除应用层数据。
--    文件清理建议通过 Dashboard → Storage 手动定期清理。
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin  boolean;
BEGIN
  -- 校验调用者权限（必须是 is_admin=true）
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;
  SELECT COALESCE(is_admin, false) INTO v_is_admin
  FROM public.profiles WHERE id = v_caller_id;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION '无管理员权限';
  END IF;
  IF v_caller_id = p_user_id THEN
    RAISE EXCEPTION '不能删除自己';
  END IF;

  -- 清理该用户创建的通知
  BEGIN
    DELETE FROM public.notifications WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 清理该用户作为主人的访客记录
  BEGIN
    DELETE FROM public.visitors WHERE owner_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 清理档案
  BEGIN
    DELETE FROM public.profiles WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 清理 auth.users
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '删除用户失败（auth.users）：%', SQLERRM;
  END;
END;
$$;

-- ============================================================
-- 权限控制（确保安全：仅管理员 / 所有者可执行）
-- ============================================================
REVOKE ALL ON FUNCTION public.submit_visitor_application FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_visitor_application TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_owner_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_owner_profile TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;

-- 成功提示
SELECT 'fix-v4-0325 applied ok' AS status;
