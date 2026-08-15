import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/common/Navbar.jsx';
import TabBar from '../components/common/TabBar.jsx';
import LinkManageCard from '../components/owner/LinkManageCard.jsx';
import VisitorStats from '../components/owner/VisitorStats.jsx';
import OwnerProfileEdit from '../components/owner/OwnerProfileEdit.jsx';
import DangerZone from '../components/owner/DangerZone.jsx';
import VisitorList from '../components/owner/VisitorList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { supabase } from '../api/supabase.js';

/**
 * 主人后台 /dashboard
 * Tab：资料编辑 / 收到的访客
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState(searchParams.get('tab') === 'visitors' ? 'visitors' : 'profile');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, revoked: 0 });
  const [unreadCount, setUnreadCount] = useState(0);

  // Tab 切换同步 URL
  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchParams(newTab === 'visitors' ? { tab: 'visitors' } : {});
  };

  // 拉取访客统计
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('status')
        .eq('owner_id', user.id);
      if (error) throw error;
      const s = { total: 0, pending: 0, approved: 0, rejected: 0, revoked: 0 };
      (data || []).forEach((v) => {
        s.total++;
        if (s[v.status] !== undefined) s[v.status]++;
      });
      setStats(s);
    } catch (err) {
      console.error('统计失败:', err.message);
    }
  }, [user?.id]);

  // 拉取未读通知数
  const fetchUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('未读数查询失败:', err.message);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
    fetchUnread();
  }, [fetchStats, fetchUnread]);

  // 切换链接开关
  const handleToggleLink = async (newActive) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ link_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // 退出
  const handleSignOut = async () => {
    await signOut();
    showToast('👋 已退出', 'success');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="app-wrapper">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-sm text-text-secondary">加载中...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="app-wrapper">
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <div className="phone-body">
          {/* 顶部导航 */}
          <div className="flex items-center justify-between py-1 pb-4">
            <div className="text-[17px] font-semibold text-text">👤 主人后台</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/notifications')}
                className="relative text-lg cursor-pointer bg-transparent border-none"
                aria-label="通知"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-danger text-white text-[10px] font-semibold rounded-full px-1 leading-4 min-w-[16px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleSignOut}
                className="text-xs text-text-secondary cursor-pointer hover:text-primary bg-transparent border-none"
              >
                退出
              </button>
            </div>
          </div>

          {/* Tab 切换 */}
          <TabBar
            tabs={[
              { key: 'profile', label: '📝 资料编辑' },
              { key: 'visitors', label: '📋 收到的访客', badge: stats.pending || undefined },
            ]}
            active={tab}
            onChange={handleTabChange}
          />

          {tab === 'profile' && (
            <>
              {/* 链接管理 */}
              <LinkManageCard profile={profile} onToggleLink={handleToggleLink} />

              {/* 访客统计 */}
              <VisitorStats stats={stats} />

              {/* 资料编辑 */}
              <OwnerProfileEdit onSaved={fetchStats} />

              {/* 危险操作 */}
              <DangerZone
                onCleared={() => {
                  fetchStats();
                  fetchUnread();
                }}
              />

              <SafetyTip />
            </>
          )}

          {tab === 'visitors' && (
            <VisitorList
              stats={stats}
              onStatsChange={fetchStats}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SafetyTip() {
  return (
    <div className="mt-3 px-3.5 py-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-700 leading-relaxed text-center">
      🛡️ 请勿向任何人泄露银行卡号、验证码、密码。
    </div>
  );
}
