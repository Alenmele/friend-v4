import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabase.js';

const AuthContext = createContext(null);

/**
 * 认证上下文
 * - user: 当前登录用户（null 表示未登录）
 * - profile: 主人档案（profiles 表）
 * - loading: 初始化加载中
 * - signIn / signOut: 登录登出
 * - refreshProfile: 重新拉取 profile
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 拉取主人档案
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('获取档案失败:', err.message);
      setProfile(null);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) return await fetchProfile(user.id);
    return null;
  };

  // 初始化：监听会话变化
  useEffect(() => {
    let mounted = true;

    // 获取当前会话
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('初始化会话失败:', err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    // 监听 auth 状态变化
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // 登录
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // 登出
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('登出失败:', err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
