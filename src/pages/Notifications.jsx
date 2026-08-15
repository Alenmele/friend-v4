import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar.jsx';
import TabBar from '../components/common/TabBar.jsx';
import NotificationItem from '../components/notification/NotificationItem.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Button from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { supabase } from '../api/supabase.js';
import { getErrorMessage } from '../utils/errorMap.js';

/**
 * 通知中心 /notifications
 * - 分类：全部 / 未读 / 系统
 * - 全部已读
 * - 点击单条标记已读并跳转
 */
export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'system') {
        query = query.eq('type', 'system');
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      setNotifications(data || []);

      // 统计未读
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('通知查询失败:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 全部已读
  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: user.id,
      });
      if (error) throw error;
      showToast('✅ 全部已读', 'success');
      fetchNotifications();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  // 单条已读回调
  const handleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="app-wrapper">
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <div className="phone-body">
          <Navbar
            title="🔔 通知中心"
            onBack={() => navigate('/dashboard')}
            right={
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                全部已读
              </Button>
            }
          />

          <TabBar
            tabs={[
              { key: 'all', label: '全部' },
              { key: 'unread', label: '未读', badge: unreadCount || undefined },
              { key: 'system', label: '系统' },
            ]}
            active={filter}
            onChange={setFilter}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-xs text-text-secondary">加载中...</div>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon="🔕"
              title={filter === 'unread' ? '没有未读通知' : '暂无通知'}
              description={filter === 'unread' ? '所有消息都已查看' : '有新消息时会显示在这里'}
            />
          ) : (
            <div className="card p-0">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
