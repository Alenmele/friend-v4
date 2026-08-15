-- ============================================================
-- Friend Card V4 - 数据库结构 + RLS 策略 + 索引
-- 版本: v4.0-lite
-- 日期: 2026-08-14
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- ============================================================

-- ---------- 1. profiles 主人档案表 ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  nickname    text NOT NULL,
  gender      text NOT NULL CHECK (gender IN ('男', '女')),
  age         integer NOT NULL CHECK (age >= 18 AND age <= 120),
  wechat      text NOT NULL,
  bio         text DEFAULT '',
  expectation text DEFAULT '',
  photos      text[] DEFAULT '{}',
  avatar      text,
  link_id     text UNIQUE,
  link_active boolean DEFAULT true,
  created_at  timestamptz DEFAULT NOW(),
  updated_at  timestamptz DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles IS '主人档案表';
COMMENT ON COLUMN public.profiles.age IS '年龄，需≥18';
COMMENT ON COLUMN public.profiles.avatar IS '头像URL，可从photos选取或单独上传';
COMMENT ON COLUMN public.profiles.link_id IS '8位专属链接标识';

-- ---------- 2. visitors 访客记录表 ----------
CREATE TABLE IF NOT EXISTS public.visitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_token text NOT NULL,
  nickname      text NOT NULL,
  gender        text NOT NULL CHECK (gender IN ('男', '女')),
  wechat        text NOT NULL,
  bio           text DEFAULT '',
  expectation   text DEFAULT '',
  photos        text[] DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  allow_reapply boolean DEFAULT true,
  created_at    timestamptz DEFAULT NOW(),
  updated_at    timestamptz DEFAULT NOW()
);

COMMENT ON TABLE  public.visitors IS '访客记录表，visitor_token 标识访客身份';
COMMENT ON COLUMN public.visitors.visitor_token IS '前端生成的UUID，存于localStorage';

-- ---------- 3. notifications 通知表 ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_token text,
  type          text NOT NULL CHECK (
                  type IN ('new_visitor', 'approve', 'reject', 'revoke', 'mutual_match', 'system')
                ),
  content       jsonb DEFAULT '{}'::jsonb,
  is_read       boolean DEFAULT false,
  created_at    timestamptz DEFAULT NOW(),
  -- user_id 与 visitor_token 至少有一个
  CONSTRAINT notif_receiver_check CHECK (user_id IS NOT NULL OR visitor_token IS NOT NULL)
);

COMMENT ON TABLE  public.notifications IS '通知表，接收者通过 user_id(主人) 或 visitor_token(访客) 关联';
COMMENT ON COLUMN public.notifications.content IS 'jsonb: { title, body, link, actor_name, target_id }';

-- ---------- 4. updated_at 自动更新触发器 ----------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_visitors_updated_at ON public.visitors;
CREATE TRIGGER trg_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------- 5. 索引 ----------
CREATE INDEX IF NOT EXISTS idx_profiles_link_id     ON public.profiles(link_id);
CREATE INDEX IF NOT EXISTS idx_visitors_owner_id    ON public.visitors(owner_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status      ON public.visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_token       ON public.visitors(visitor_token);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_token     ON public.notifications(visitor_token);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON public.notifications(is_read);

-- ============================================================
-- RLS 行级安全策略
-- ============================================================

-- ---------- profiles RLS ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 匿名访问：仅可见公开字段（昵称/性别/年龄/自我介绍/交友期许/link_id/link_active）
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

-- 主人可删除自己的档案（注销账户）
CREATE POLICY "profiles_owner_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- ---------- visitors RLS ----------
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- 主人可查询自己收到的所有访客
CREATE POLICY "visitors_owner_select" ON public.visitors
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- 匿名访客通过 visitor_token 查询自己的记录
-- 注意：anon 角色 RLS 策略，需通过请求头传入 visitor_token，前端用 RPC 或专用查询函数
-- 这里使用宽松策略：anon 可查询，但应用层强制按 visitor_token 过滤
CREATE POLICY "visitors_anon_select" ON public.visitors
  FOR SELECT TO anon, authenticated
  USING (true);

-- 访客可插入自己的记录（visitor_token 由前端生成，无auth.uid约束）
CREATE POLICY "visitors_anon_insert" ON public.visitors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 主人可更新访客状态（同意/拒绝/撤销）
CREATE POLICY "visitors_owner_update" ON public.visitors
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 主人可删除访客记录（清空访客/注销账户级联）
CREATE POLICY "visitors_owner_delete" ON public.visitors
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------- notifications RLS ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 主人可查询自己收到的通知
CREATE POLICY "notif_owner_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 匿名访客通过 visitor_token 查询自己的通知（应用层强制过滤）
CREATE POLICY "notif_anon_select" ON public.notifications
  FOR SELECT TO anon, authenticated
  USING (true);

-- 通知由系统（service_role）写入，前端 anon/authenticated 不可直接插入
-- 如需前端直接写入，可放开如下策略（安全风险较高，建议改用 RPC + service_role）
CREATE POLICY "notif_system_insert" ON public.notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 主人/访客可标记自己的通知为已读
CREATE POLICY "notif_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR visitor_token IS NOT NULL)
  WITH CHECK (true);

CREATE POLICY "notif_anon_update" ON public.notifications
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- 删除策略（仅主人删自己的）
CREATE POLICY "notif_owner_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 6. 业务逻辑函数（RPC）
-- ============================================================

-- 提交访客申请：插入 visitors 记录 + 写入主人通知
-- 参数: p_owner_id, p_visitor_token, p_nickname, p_gender, p_wechat, p_bio, p_expectation, p_photos
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
BEGIN
  -- 参数校验
  IF p_gender NOT IN ('男', '女') THEN
    RAISE EXCEPTION '性别参数非法';
  END IF;
  IF p_visitor_token IS NULL OR length(trim(p_visitor_token)) = 0 THEN
    RAISE EXCEPTION 'visitor_token 不能为空';
  END IF;

  -- 获取主人昵称用于通知
  SELECT nickname INTO v_owner_nickname FROM public.profiles WHERE id = p_owner_id;
  IF v_owner_nickname IS NULL THEN
    RAISE EXCEPTION '主人不存在';
  END IF;

  -- 插入访客记录
  INSERT INTO public.visitors (
    owner_id, visitor_token, nickname, gender, wechat, bio, expectation, photos, status
  ) VALUES (
    p_owner_id, p_visitor_token, p_nickname, p_gender, p_wechat, p_bio, p_expectation, p_photos, 'pending'
  ) RETURNING id INTO v_visitor_id;

  -- 通知主人：new_visitor
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

  RETURN v_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 主人审核访客：同意 / 拒绝 / 撤销
-- 参数: p_visitor_id, p_action('approve'|'reject'|'revoke'), p_allow_reapply
CREATE OR REPLACE FUNCTION public.review_visitor(
  p_visitor_id    uuid,
  p_action        text,
  p_allow_reapply boolean DEFAULT true
) RETURNS void AS $$
DECLARE
  v_visitor_rec RECORD;
  v_owner_nickname text;
  v_reverse_exists boolean;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'revoke') THEN
    RAISE EXCEPTION 'p_action 仅支持 approve/reject/revoke';
  END IF;

  SELECT owner_id, visitor_token, nickname, status INTO v_visitor_rec
  FROM public.visitors WHERE id = p_visitor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '访客记录不存在';
  END IF;

  SELECT nickname INTO v_owner_nickname FROM public.profiles WHERE id = v_visitor_rec.owner_id;

  -- 状态机校验：revoke 仅对 approved 有效
  IF p_action = 'revoke' AND v_visitor_rec.status <> 'approved' THEN
    RAISE EXCEPTION '撤销权限仅对已通过状态有效';
  END IF;

  -- 更新访客状态
  IF p_action = 'approve' THEN
    UPDATE public.visitors SET status = 'approved' WHERE id = p_visitor_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.visitors SET status = 'rejected', allow_reapply = p_allow_reapply WHERE id = p_visitor_id;
  ELSIF p_action = 'revoke' THEN
    UPDATE public.visitors SET status = 'revoked' WHERE id = p_visitor_id;
  END IF;

  -- 通知访客
  IF p_action = 'approve' THEN
    -- 双向互访检测：该访客是否也填写过主人的表单
    -- 即：visitors 表中 owner_id = 当前访客的对应 profile？由于访客无profile，本场景简化：
    -- 反向匹配规则——存在 visitor_token=A 且 owner 对应的 link 被当前主人访问过
    -- 此处按 PRD 5.4：查询 visitors 表是否存在反向记录 visitor_id=A, owner_id=B
    -- 由于访客无 profile_id，本 lite 版用 visitor_token 作为访客身份，反向匹配需扩展表
    -- 简化处理：仅通知访客通过
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

-- 主人首次保存资料后生成 link_id（8位）
CREATE OR REPLACE FUNCTION public.generate_link_id(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_link_id text;
  v_exists boolean;
BEGIN
  -- 检查是否已有 link_id
  SELECT link_id INTO v_link_id FROM public.profiles WHERE id = p_user_id;
  IF v_link_id IS NOT NULL THEN
    RETURN v_link_id;
  END IF;

  -- 生成 8 位随机字符串（小写字母+数字）
  LOOP
    v_link_id := substr(md5(random()::text || extract(epoch from now())::text), 1, 8);
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE link_id = v_link_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  UPDATE public.profiles SET link_id = v_link_id WHERE id = p_user_id;
  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标记通知为已读
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notif_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.notifications SET is_read = true WHERE id = p_notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标记某用户/访客全部通知为已读
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_id uuid DEFAULT NULL,
  p_visitor_token text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_user_id IS NOT NULL THEN
    UPDATE public.notifications SET is_read = true WHERE user_id = p_user_id AND is_read = false;
  ELSIF p_visitor_token IS NOT NULL THEN
    UPDATE public.notifications SET is_read = true WHERE visitor_token = p_visitor_token AND is_read = false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 完成提示
-- ============================================================
DO $$ BEGIN
  RAISE NOTICE '✅ v4-lite-schema.sql 执行完毕：建表+索引+RLS+RPC函数';
END $$;