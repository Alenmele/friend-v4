import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase.js';
import { storage } from '../utils/storage.js';
import { getErrorMessage } from '../utils/errorMap.js';

/**
 * 访客身份与状态管理
 * - 获取/创建 visitor_token
 * - 查询某链接下的访客状态
 * - 提交申请
 */
export function useVisitor(linkId) {
  const [ownerProfile, setOwnerProfile] = useState(null);  // 主人公开档案
  const [visitorRecord, setVisitorRecord] = useState(null); // 访客自己的记录
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenario, setScenario] = useState('loading'); // loading | locked | pending | approved | rejected | revoked | link_closed | invalid_link | self_visit
  const [submitting, setSubmitting] = useState(false); // 提交并发锁

  const visitorToken = storage.getOrCreateVisitorToken();

  // 拉取主人公开档案 + 访客记录
  const fetchData = useCallback(async () => {
    if (!linkId) {
      setError('链接ID缺失');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. 查询主人档案
      const { data: owner, error: ownerErr } = await supabase
        .from('profiles')
        .select('id, nickname, gender, age, bio, expectation, photos, avatar, link_id, link_active')
        .eq('link_id', linkId)
        .single();

      if (ownerErr || !owner) {
        setScenario('invalid_link');
        setLoading(false);
        return;
      }

      // 2. 链接关闭
      if (!owner.link_active) {
        setOwnerProfile(owner);
        setScenario('link_closed');
        setLoading(false);
        return;
      }

      // 3. 自己访问自己的链接（auth.uid() == owner.id）
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === owner.id) {
        setOwnerProfile(owner);
        setScenario('self_visit');
        setLoading(false);
        return;
      }

      setOwnerProfile(owner);

      // 4. 查询访客记录
      const { data: visitor, error: visitorErr } = await supabase
        .from('visitors')
        .select('*')
        .eq('owner_id', owner.id)
        .eq('visitor_token', visitorToken)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (visitorErr) throw visitorErr;

      if (!visitor) {
        // 从未提交
        setScenario('locked');
        // 同步 localStorage 状态
        storage.clearVisitorStatus(linkId);
      } else {
        setVisitorRecord(visitor);
        setScenario(visitor.status); // pending / approved / rejected / revoked
        storage.setVisitorStatus(linkId, visitor.status, Date.now());
      }
    } catch (err) {
      console.error('访客状态查询失败:', err.message);
      setError(err.message);
      setScenario('invalid_link');
    } finally {
      setLoading(false);
    }
  }, [linkId, visitorToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * 提交访客申请（加并发锁，防止重复提交）
   */
  const submitApplication = async (formData) => {
    if (!ownerProfile) return { success: false, error: '主人档案未加载' };
    if (submitting) return { success: false, error: '正在提交中，请稍候' };
    setSubmitting(true);
    try {
      // 调用 RPC（参数与后端对齐：不含 p_age，含 p_bio/p_expectation/p_photos）
      // 头像统一用第二张照片（若存在）
      const p_photos = formData.photos || [];
      const p_avatar = p_photos[1] || p_photos[0] || null;
      const { data, error } = await supabase.rpc('submit_visitor_application', {
        p_owner_id: ownerProfile.id,
        p_visitor_token: visitorToken,
        p_nickname: formData.nickname,
        p_gender: formData.gender,
        p_wechat: formData.wechat || '',
        p_wechat_qr: formData.wechat_qr || '',
        p_bio: formData.bio || '',
        p_expectation: formData.expectation || '',
        p_photos: p_photos,
        p_avatar: p_avatar,
      });
      if (error) throw error;

      // 更新本地状态
      storage.setVisitorStatus(linkId, 'pending', Date.now());
      storage.clearDraft(linkId);
      await fetchData(); // 重新拉取
      return { success: true, visitorId: data };
    } catch (err) {
      console.error('提交申请失败:', err.message);
      return { success: false, error: getErrorMessage(err) };
    } finally {
      setSubmitting(false);
    }
  };

  return {
    visitorToken,
    ownerProfile,
    visitorRecord,
    loading,
    error,
    scenario,
    submitting,
    refresh: fetchData,
    submitApplication,
  };
}
