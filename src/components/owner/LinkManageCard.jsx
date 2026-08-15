import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../common/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../api/supabase.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 链接管理卡片
 * - 显示专属链接
 * - 复制链接
 * - 预览卡片
 * - 关闭/开启链接
 */
export default function LinkManageCard({ profile, onToggleLink }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [toggling, setToggling] = useState(false);

  const linkId = profile?.link_id;
  const isActive = profile?.link_active !== false;
  // 根据部署环境生成正确的访客链接
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const fullLink = linkId ? `${window.location.origin}${baseUrl}/u/${linkId}` : '';

  const handleCopy = async () => {
    if (!fullLink) {
      showToast('链接尚未生成', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(fullLink);
      showToast('📋 已复制链接', 'success');
    } catch {
      // 降级方案
      const input = document.createElement('input');
      input.value = fullLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('📋 已复制链接', 'success');
    }
  };

  const handlePreview = () => {
    if (!linkId) {
      showToast('链接尚未生成', 'error');
      return;
    }
    navigate(`/u/${linkId}`);
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const result = await onToggleLink(!isActive);
      if (result?.success) {
        showToast(isActive ? '🔒 链接已关闭' : '✅ 链接已开启', 'success');
      } else {
        showToast(getErrorMessage(result?.error), 'error');
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="card card-brand">
      <div className="text-xs font-medium text-primary-dark mb-2">🔗 我的专属链接</div>

      {linkId ? (
        <>
          <div className="link-box bg-white rounded-full px-4 py-2.5 text-[13px] break-all border border-border mb-2.5">
            {fullLink}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={handleCopy}>
              📋 复制链接
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handlePreview}>
              👁️ 预览
            </Button>
            <Button
              variant={isActive ? 'outline' : 'primary'}
              size="sm"
              className="flex-1"
              loading={toggling}
              onClick={handleToggle}
            >
              {isActive ? '🔒 关闭' : '✅ 开启'}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-sm text-text-secondary text-center py-4">
          保存资料后将自动生成专属链接
        </div>
      )}
    </div>
  );
}
