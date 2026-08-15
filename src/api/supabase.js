import { createClient } from '@supabase/supabase-js';

// 读取环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 参数校验：环境变量缺失时给出明确提示
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ 缺少 Supabase 环境变量，请在 .env.local 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  );
}

// 创建 Supabase 客户端
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Storage bucket 名称常量（与 v4-storage.sql 对应）
export const BUCKETS = {
  AVATARS: 'avatars',
  OWNER_PHOTOS: 'owner-photos',
  VISITOR_PHOTOS: 'visitor-photos',
};

// localStorage key 常量
export const STORAGE_KEYS = {
  VISITOR_TOKEN: 'fc_visitor_token',                  // 全局访客 token
  VISITOR_STATUS: (linkId) => `fc_visitor_status_${linkId}`, // 各链接下的访问状态
  DRAFT: (linkId) => `fc_draft_${linkId}`,            // 表单草稿
};
