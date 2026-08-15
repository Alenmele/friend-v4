-- ============================================================
-- Friend Card V4 - Storage Bucket + RLS 策略
-- 版本: v4.0-lite
-- 日期: 2026-08-14
-- 说明: 在 Supabase SQL Editor 中执行本文件
-- 路径规则:
--   主人头像:  avatars/{user_id}/{ts}_{rand}.ext
--   主人照片:  owner-photos/{user_id}/{ts}_{rand}.ext
--   访客照片:  visitor-photos/{owner_id}/{visitor_token}/{ts}_{rand}.ext
-- ============================================================

-- ---------- 1. 创建 storage buckets ----------
-- 头像 bucket（公开读）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 主人照片 bucket（公开读，因访客通过页面需要看到）
INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-photos', 'owner-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 访客照片 bucket（公开读，因主人审核需要看到）
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitor-photos', 'visitor-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ---------- 2. avatars bucket 策略 ----------
-- 公开读
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- 仅本人可上传/更新自己的头像（路径前缀 = user_id）
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅本人可删除自己的头像
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 3. owner-photos bucket 策略 ----------
-- 公开读（访客通过页可见）
CREATE POLICY "owner_photos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'owner-photos');

-- 仅主人可上传自己的照片
CREATE POLICY "owner_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'owner-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "owner_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'owner-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'owner-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "owner_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'owner-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 4. visitor-photos bucket 策略 ----------
-- 公开读（主人审核时可见）
CREATE POLICY "visitor_photos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'visitor-photos');

-- 访客免登录可上传（路径 owner_id/visitor_token/...）
-- 注意：anon 角色无 auth.uid()，需通过应用层路径约束
CREATE POLICY "visitor_photos_anon_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'visitor-photos');

-- 仅主人可删除其名下访客的照片
CREATE POLICY "visitor_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'visitor-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- 完成提示
-- ============================================================
DO $$ BEGIN
  RAISE NOTICE '✅ v4-storage.sql 执行完毕：3个bucket + RLS策略';
END $$;
