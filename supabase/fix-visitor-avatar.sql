-- ============================================================
-- Friend Card V4 - 修复 visitors 表缺失 avatar 列
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- 原因: submit_visitor_application RPC 的 INSERT 语句引用了 avatar 列，
--       但 v4-lite-schema.sql 建表时遗漏了该列，导致访客提交报
--       "数据结构错误，请联系管理员"
-- ============================================================

-- 添加 avatar 列（如果不存在）
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS avatar text;

-- 验证列已存在
DO $$ BEGIN
  RAISE NOTICE '✅ avatar 列已添加到 visitors 表';
END $$;

-- ---------- 额外检查：确保其他必要列也存在 ----------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='bio'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN bio text DEFAULT '';
    RAISE NOTICE '✅ bio 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='expectation'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN expectation text DEFAULT '';
    RAISE NOTICE '✅ expectation 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='photos'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN photos text[] DEFAULT '{}';
    RAISE NOTICE '✅ photos 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='status'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN status text NOT NULL DEFAULT 'pending';
    RAISE NOTICE '✅ status 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='allow_reapply'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN allow_reapply boolean NOT NULL DEFAULT true;
    RAISE NOTICE '✅ allow_reapply 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE '✅ created_at 列已添加';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE '✅ updated_at 列已添加';
  END IF;
END $$;

-- ---------- 确保 updated_at 触发器正常工作 ----------
CREATE OR REPLACE FUNCTION public.set_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_visitors_updated_at ON public.visitors;
CREATE TRIGGER set_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timestamp();

-- ---------- 最后：重新创建 submit_visitor_application RPC ----------
-- （确保函数引用的列都存在）
DROP FUNCTION IF EXISTS public.submit_visitor_application CASCADE;

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

REVOKE ALL ON FUNCTION public.submit_visitor_application FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_visitor_application TO anon, authenticated;

-- ---------- 完成提示 ----------
DO $$ BEGIN
  RAISE NOTICE '✅ fix-visitor-avatar.sql 执行完毕：visitors 表 avatar 列已添加，submit_visitor_application RPC 已重建';
END $$;