-- ============================================================
-- Friend Card V4 - 最终综合修复脚本
-- 功能：
--   1) 修复 submit_visitor_application 参数签名（对齐前端 + 去不存在的 age 列）
--   2) 新增 visitors(owner_id, visitor_token) 唯一约束 + UPSERT 幂等
--   3) 修复 notifications RLS，取消 anonymous SELECT/UPDATE 越权
--   4) 给 profiles 增加 is_admin 列，给主人账号 251205666@qq.com 设管理员
--   5) 修复 get_all_users / admin_delete_user 越权（仅 is_admin=true 可调用）
--   6) 修改 admin_delete_user 允许删除自己（真正的注销），并连带清理 auth.users + storage.objects
--   7) 修复 mark_notification_read / mark_all_notifications_read 只能改自己的
--   8) 新增 admin_create_user 免邮件 RPC（管理员后台添加用户用）
--   9) 删除/重建所有同名重载函数签名唯一
-- ============================================================

-- ---------- 0) 清理旧重载函数（先 DROP 再重建，保证签名唯一）----------
DROP FUNCTION IF EXISTS public.submit_visitor_application CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users CASCADE;
DROP FUNCTION IF EXISTS public.mark_notification_read CASCADE;
DROP FUNCTION IF EXISTS public.mark_all_notifications_read CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_user CASCADE;
DROP FUNCTION IF EXISTS public.update_owner_profile CASCADE;

-- ---------- 1) 给 profiles 增加 is_admin 列 ----------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 给主人账号（邮箱 251205666@qq.com）授予管理员权限
UPDATE public.profiles
SET    is_admin = true
WHERE  id IN (SELECT id FROM auth.users WHERE email = '251205666@qq.com');

-- ---------- 2) visitors 表增加唯一约束 (owner_id, visitor_token) ----------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='visitors'
      AND constraint_name='visitors_owner_token_unique'
  ) THEN
    ALTER TABLE public.visitors
      ADD CONSTRAINT visitors_owner_token_unique UNIQUE (owner_id, visitor_token);
  END IF;
END $$;

-- ---------- 3) 重建 submit_visitor_application（对齐前端参数 + UPSERT 幂等）----------
CREATE OR REPLACE FUNCTION public.submit_visitor_application(
  p_owner_id      uuid,
  p_visitor_token text,
  p_nickname      text,
  p_gender        text,
  p_wechat        text,
  p_bio           text DEFAULT '',
  p_expectation   text DEFAULT '',
  p_photos        text[] DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  v_visitor_id uuid;
  v_owner_nickname text;
  v_is_new boolean;
  v_old_status text;
  v_old_allow boolean;
BEGIN
  -- 参数校验
  IF p_owner_id IS NULL THEN RAISE EXCEPTION '主人ID不能为空'; END IF;
  IF p_visitor_token IS NULL OR length(trim(p_visitor_token)) = 0 THEN
    RAISE EXCEPTION '访客token不能为空';
  END IF;
  IF p_nickname IS NULL OR length(trim(p_nickname)) = 0 THEN
    RAISE EXCEPTION '昵称不能为空';
  END IF;
  IF p_gender NOT IN ('男', '女') THEN RAISE EXCEPTION '性别参数非法'; END IF;
  IF p_wechat IS NULL OR length(trim(p_wechat)) = 0 THEN
    RAISE EXCEPTION '微信号不能为空';
  END IF;
  IF p_photos IS NULL OR array_length(p_photos, 1) IS NULL OR array_length(p_photos, 1) < 1 THEN
    RAISE EXCEPTION '至少需要上传 1 张照片';
  END IF;

  -- 获取主人昵称
  SELECT nickname INTO v_owner_nickname FROM public.profiles WHERE id = p_owner_id;
  IF v_owner_nickname IS NULL THEN RAISE EXCEPTION '主人不存在'; END IF;

  -- 先查询是否已存在（决定 UPSERT 后的行为）
  SELECT status, allow_reapply INTO v_old_status, v_old_allow
  FROM public.visitors
  WHERE owner_id = p_owner_id AND visitor_token = p_visitor_token;

  -- UPSERT：同主人 + 同 visitor_token 冲突时，如果 allow_reapply=true 则更新并回到 pending
  INSERT INTO public.visitors (
    owner_id, visitor_token, nickname, gender, wechat, bio, expectation, photos,
    avatar, status, allow_reapply
  ) VALUES (
    p_owner_id,
    p_visitor_token,
    trim(p_nickname),
    p_gender,
    trim(p_wechat),
    coalesce(p_bio, ''),
    coalesce(p_expectation, ''),
    coalesce(p_photos, '{}'),
    CASE WHEN array_length(coalesce(p_photos, '{}'), 1) > 0 THEN p_photos[1] ELSE NULL END,
    'pending',
    true
  )
  ON CONFLICT ON CONSTRAINT visitors_owner_token_unique
  DO UPDATE SET
    nickname = EXCLUDED.nickname,
    gender = EXCLUDED.gender,
    wechat = EXCLUDED.wechat,
    bio = EXCLUDED.bio,
    expectation = EXCLUDED.expectation,
    photos = EXCLUDED.photos,
    avatar = EXCLUDED.avatar,
    status = CASE
               WHEN public.visitors.status IN ('approved', 'revoked') THEN public.visitors.status
               WHEN public.visitors.status = 'rejected' AND public.visitors.allow_reapply = true THEN 'pending'
               WHEN public.visitors.status = 'rejected' AND public.visitors.allow_reapply = false THEN 'rejected'
               ELSE 'pending'
             END,
    updated_at = NOW()
  RETURNING id INTO v_visitor_id;

  -- 如果是 rejected 且不允许重新申请，直接告诉用户
  IF v_old_status = 'rejected' AND v_old_allow = false THEN
    RAISE EXCEPTION '抱歉，主人暂不允许你重新申请';
  END IF;

  v_is_new := (v_old_status IS NULL);

  -- 只有全新提交，或者被拒绝后允许重新申请且这次成功回 pending 才给主人发通知
  IF v_is_new OR (v_old_status = 'rejected' AND v_old_allow = true) THEN
    INSERT INTO public.notifications (user_id, type, content)
    VALUES (
      p_owner_id,
      'new_visitor',
      jsonb_build_object(
        'title', p_nickname || ' 向你提交了好友申请',
        'body',  '点击查看详情并审核',
        'actor_name', p_nickname,
        'target_id', v_visitor_id::text,
        'link', '/dashboard?tab=visitors'
      )
    );
  END IF;

  RETURN v_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 收回 PUBLIC 的 EXECUTE（只显式授予 anon/authenticated）
REVOKE ALL ON FUNCTION public.submit_visitor_application FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_visitor_application TO anon, authenticated;

-- ---------- 4) 修复 notifications 的 RLS（anon 只能 INSERT，绝对不能 SELECT/UPDATE）----------
DROP POLICY IF EXISTS notif_anon_select ON public.notifications;
DROP POLICY IF EXISTS notif_anon_update ON public.notifications;
DROP POLICY IF EXISTS notif_owner_select ON public.notifications;
DROP POLICY IF EXISTS notif_owner_update ON public.notifications;
DROP POLICY IF EXISTS notif_owner_delete ON public.notifications;
DROP POLICY IF EXISTS notif_system_insert ON public.notifications;

-- 主人 SELECT 自己的
CREATE POLICY "notif_owner_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 主人 UPDATE 自己的（标记已读）
CREATE POLICY "notif_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 主人 DELETE 自己的
CREATE POLICY "notif_owner_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 写入：anon/authenticated 都允许（因为 submit_visitor_application / review_visitor 在 SECURITY DEFINER 里写入，对 anon 仍需要 policy）
CREATE POLICY "notif_system_insert" ON public.notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ---------- 5) 标记通知为已读：强制只能改自己的 ----------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notif_id uuid)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  UPDATE public.notifications
  SET    is_read = true
  WHERE  id = p_notif_id
    AND  user_id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.mark_notification_read FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;

-- 标记自己的所有通知为已读
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  UPDATE public.notifications
  SET    is_read = true
  WHERE  user_id = v_uid AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;

-- ---------- 6) get_all_users：仅 is_admin 可调用 ----------
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS json AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF v_is_admin IS NOT true THEN RAISE EXCEPTION '无管理员权限'; END IF;

  RETURN (
    SELECT json_agg(json_build_object(
      'id', u.id::text,
      'email', u.email,
      'nickname', coalesce(p.nickname, '未设置'),
      'gender', p.gender,
      'age', p.age,
      'wechat', p.wechat,
      'created_at', u.created_at::text,
      'is_admin', coalesce(p.is_admin, false)
    ))
    FROM   auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.get_all_users FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_all_users TO authenticated;

-- ---------- 7) admin_delete_user：仅 is_admin 可调用；或允许任何人删除自己（真正注销）----------
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_self boolean;
  v_owner_id uuid;
  v_rec RECORD;
  v_folder text;
  v_prefix text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  v_is_self := (p_user_id = v_uid);

  -- 如果不是删自己，校验管理员权限
  IF NOT v_is_self THEN
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_uid;
    IF v_is_admin IS NOT true THEN RAISE EXCEPTION '无管理员权限'; END IF;
  END IF;

  -- 清理 storage.objects：主人 avatars / owner-photos / visitor-photos 下前缀匹配的文件
  v_owner_id := p_user_id;
  v_folder := v_owner_id::text || '/';

  -- 先取出所有相关 visitors 的 visitor_token 用于 visitor-photos 删除
  FOR v_rec IN
    SELECT visitor_token FROM public.visitors WHERE owner_id = v_owner_id
  LOOP
    v_prefix := v_folder || v_rec.visitor_token || '/';
    DELETE FROM storage.objects
     WHERE bucket_id IN ('visitor-photos')
       AND name LIKE v_prefix || '%';
  END LOOP;

  -- 删除 owner-photos / avatars 以 user id 为前缀的对象
  DELETE FROM storage.objects
   WHERE bucket_id IN ('owner-photos', 'avatars')
     AND name LIKE v_folder || '%';

  -- 删 profiles（会 CASCADE 删 visitors / notifications，因为 profiles FK 指向 auth.users ON DELETE CASCADE + visitors 的 FK 指向 profiles ON DELETE CASCADE）
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 最后删除 auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.admin_delete_user FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;

-- ---------- 8) admin_create_user：管理员免邮件创建用户（初始密码 Aa123456）----------
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email    text,
  p_nickname text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_user_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF v_is_admin IS NOT true THEN RAISE EXCEPTION '无管理员权限'; END IF;

  p_email := lower(trim(p_email));
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION '邮箱格式不正确';
  END IF;

  -- 检查是否已存在
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN RAISE EXCEPTION '该邮箱已注册'; END IF;

  -- auth.users 插入（Supabase 推荐的明文密码经过 crypt 存储；禁止 insecure 方式）
  -- 使用 gen_random_uuid() 作为 user id，encrypted_password 使用默认 bf salt，email_confirmed_at 自动确认
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_email,
    crypt('Aa123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nickname', coalesce(nullif(trim(p_nickname), ''), '新用户')),
    false,
    'authenticated'
  ) RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.admin_create_user FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_create_user TO authenticated;

-- ---------- 9) update_owner_profile（保留，主人 profile 有 age）----------
CREATE OR REPLACE FUNCTION public.update_owner_profile(
  p_nickname    text,
  p_gender      text,
  p_age         integer,
  p_wechat      text,
  p_bio         text DEFAULT '',
  p_expectation text DEFAULT '',
  p_photos      text[] DEFAULT '{}',
  p_avatar      text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;

  UPDATE public.profiles SET
    nickname    = trim(p_nickname),
    gender      = p_gender,
    age         = p_age,
    wechat      = trim(p_wechat),
    bio         = coalesce(p_bio, ''),
    expectation = coalesce(p_expectation, ''),
    photos      = coalesce(p_photos, '{}'),
    avatar      = coalesce(
                    p_avatar,
                    CASE WHEN array_length(coalesce(p_photos, '{}'), 1) > 0
                         THEN p_photos[1] ELSE NULL END
                  ),
    updated_at  = NOW()
  WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.update_owner_profile FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_owner_profile TO authenticated;

-- ---------- 10) review_visitor（重建 + 校验：只能审核自己的访客）----------
DROP FUNCTION IF EXISTS public.review_visitor CASCADE;
CREATE OR REPLACE FUNCTION public.review_visitor(
  p_visitor_id    uuid,
  p_action        text,
  p_allow_reapply boolean DEFAULT true
) RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visitor_rec RECORD;
  v_owner_nickname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '用户未登录'; END IF;
  IF p_action NOT IN ('approve', 'reject', 'revoke') THEN
    RAISE EXCEPTION 'p_action 仅支持 approve/reject/revoke';
  END IF;

  SELECT id, owner_id, visitor_token, nickname, status INTO v_visitor_rec
  FROM public.visitors WHERE id = p_visitor_id;
  IF NOT FOUND THEN RAISE EXCEPTION '访客记录不存在'; END IF;

  -- 安全：主人只能审核自己的访客
  IF v_visitor_rec.owner_id <> v_uid THEN
    RAISE EXCEPTION '你无权审核其他主人的访客';
  END IF;

  SELECT nickname INTO v_owner_nickname FROM public.profiles WHERE id = v_visitor_rec.owner_id;

  IF p_action = 'revoke' AND v_visitor_rec.status <> 'approved' THEN
    RAISE EXCEPTION '撤销权限仅对已通过状态有效';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.visitors SET status = 'approved' WHERE id = p_visitor_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.visitors SET status = 'rejected', allow_reapply = p_allow_reapply WHERE id = p_visitor_id;
  ELSIF p_action = 'revoke' THEN
    UPDATE public.visitors SET status = 'revoked' WHERE id = p_visitor_id;
  END IF;

  IF p_action = 'approve' THEN
    INSERT INTO public.notifications (visitor_token, type, content)
    VALUES (
      v_visitor_rec.visitor_token,
      'approve',
      jsonb_build_object(
        'title', v_owner_nickname || ' 通过了你的申请',
        'body',  '你们已互相解锁，可以查看完整资料了',
        'actor_name', v_owner_nickname,
        'target_id', p_visitor_id::text,
        'link', '/'
      )
    );
  ELSIF p_action = 'reject' THEN
    INSERT INTO public.notifications (visitor_token, type, content)
    VALUES (
      v_visitor_rec.visitor_token,
      'reject',
      jsonb_build_object(
        'title', '你的申请未被 ' || v_owner_nickname || ' 通过',
        'body',  CASE WHEN p_allow_reapply THEN '你可以重新申请' ELSE '暂不支持重新申请' END,
        'actor_name', v_owner_nickname,
        'target_id', p_visitor_id::text,
        'link', '/'
      )
    );
  ELSIF p_action = 'revoke' THEN
    INSERT INTO public.notifications (visitor_token, type, content)
    VALUES (
      v_visitor_rec.visitor_token,
      'revoke',
      jsonb_build_object(
        'title', v_owner_nickname || ' 已撤销你的查看权限',
        'body',  '你的查看权限已被撤销',
        'actor_name', v_owner_nickname,
        'target_id', p_visitor_id::text,
        'link', '/'
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.review_visitor FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.review_visitor TO authenticated;

-- ---------- 完成提示 ----------
DO $$ BEGIN
  RAISE NOTICE '✅ fix-v4-final.sql 执行完毕：RPC 对齐 + 权限修复 + 免邮件创建用户 + 越权漏洞修复';
END $$;
