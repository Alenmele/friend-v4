-- ============================================================
-- 紧急修复：RLS SELECT 权限问题
-- 根因: authenticated / anon 角色缺少 schema public 和表的基础权限
-- ============================================================

-- 1. 授予 schema 使用权限
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. 授予 profiles 表读写权限给 authenticated；给 anon 读
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 3. 授予 visitors 表读写
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT SELECT, INSERT ON public.visitors TO anon;

-- 4. 授予 notifications 表读写
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO anon;

-- 5. 序列权限（如果有）
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 6. 重新构建 RLS 策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles 策略
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
CREATE POLICY "profiles_public_select" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
CREATE POLICY "profiles_owner_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_owner_delete" ON public.profiles;
CREATE POLICY "profiles_owner_delete" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- visitors 策略
DROP POLICY IF EXISTS "visitors_owner_select" ON public.visitors;
CREATE POLICY "visitors_owner_select" ON public.visitors
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "visitors_anon_select" ON public.visitors;
CREATE POLICY "visitors_anon_select" ON public.visitors
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "visitors_anon_insert" ON public.visitors;
CREATE POLICY "visitors_anon_insert" ON public.visitors
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "visitors_owner_update" ON public.visitors;
CREATE POLICY "visitors_owner_update" ON public.visitors
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "visitors_owner_delete" ON public.visitors;
CREATE POLICY "visitors_owner_delete" ON public.visitors
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- notifications 策略
DROP POLICY IF EXISTS "notif_owner_select" ON public.notifications;
CREATE POLICY "notif_owner_select" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_anon_select" ON public.notifications;
CREATE POLICY "notif_anon_select" ON public.notifications
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "notif_system_insert" ON public.notifications;
CREATE POLICY "notif_system_insert" ON public.notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_owner_update" ON public.notifications;
CREATE POLICY "notif_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR visitor_token IS NOT NULL)
  WITH CHECK (true);

DROP POLICY IF EXISTS "notif_anon_update" ON public.notifications;
CREATE POLICY "notif_anon_update" ON public.notifications
  FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "notif_owner_delete" ON public.notifications;
CREATE POLICY "notif_owner_delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DO $$ BEGIN
  RAISE NOTICE '✅ fix-permissions.sql 执行完毕：schema权限+GRANT+RLS全部重建';
END $$;
