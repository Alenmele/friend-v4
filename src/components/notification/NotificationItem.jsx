import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabase.js';

const TYPE_ICONS = {
  new_visitor: '🆕',
  approve: '✅',
  reject: '❌',
  revoke: '↩️',
  mutual_match: '💞',
  system: '🔔',
};

/**
 * 单条通知项
 * - 未读：左侧蓝点 + 浅蓝背景
 * - 已读：无蓝点 + 正常背景
 * - 点击整行跳转并标记已读
 */
export default function NotificationItem({ notification, onRead }) {
  const navigate = useNavigate();

  const handleClick = async () => {
    // 标记已读
    if (!notification.is_read) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);
        onRead?.(notification.id);
      } catch (err) {
        console.error('标记已读失败:', err.message);
      }
    }

    // 跳转
    const link = notification.content?.link;
    if (link) {
      navigate(link);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const icon = TYPE_ICONS[notification.type] || '🔔';
  const title = notification.content?.title || '通知';
  const body = notification.content?.body || '';
  const isUnread = !notification.is_read;

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 items-start p-3.5 border-b border-border cursor-pointer hover:bg-surface-muted transition ${
        isUnread ? 'bg-[#f5f8ff]' : ''
      }`}
    >
      {/* 未读蓝点 */}
      <div
        className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
          isUnread ? 'bg-primary' : 'bg-transparent'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">
          {icon} {title}
        </div>
        {body && (
          <div className="text-xs text-text-secondary leading-relaxed mt-0.5">
            {body}
          </div>
        )}
        <div className="text-[11px] text-text-light mt-1">
          {formatTime(notification.created_at)}
        </div>
      </div>
    </div>
  );
}
