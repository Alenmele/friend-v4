import { useState } from 'react';
import Card, { CardLabel, CardValue } from '../common/Card.jsx';
import Tag from '../common/Tag.jsx';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import PhotoGrid from '../common/PhotoGrid.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../api/supabase.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 单个访客卡片
 * - 待审核：同意解锁 / 拒绝（含 allow_reapply 开关）
 * - 已通过：撤销权限
 * - 已拒绝/已撤销：展示状态，无操作
 */
export default function VisitorCard({ visitor, onAction }) {
  const { showToast } = useToast();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [allowReapply, setAllowReapply] = useState(true);
  const [acting, setActing] = useState(false);

  const handleApprove = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('review_visitor', {
        p_visitor_id: visitor.id,
        p_action: 'approve',
      });
      if (error) throw error;
      showToast(`✅ 已通过${visitor.nickname}的申请`, 'success');
      onAction?.();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('review_visitor', {
        p_visitor_id: visitor.id,
        p_action: 'reject',
        p_allow_reapply: allowReapply,
      });
      if (error) throw error;
      showToast(`❌ 已拒绝${visitor.nickname}`, 'success');
      setShowRejectModal(false);
      onAction?.();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActing(false);
    }
  };

  const handleRevoke = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('review_visitor', {
        p_visitor_id: visitor.id,
        p_action: 'revoke',
      });
      if (error) throw error;
      showToast(`↩️ 已撤销${visitor.nickname}的权限`, 'success');
      setShowRevokeModal(false);
      onAction?.();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActing(false);
    }
  };

  // 时间格式化
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

  return (
    <Card
      className={
        visitor.status === 'approved'
          ? 'border-l-[3px] border-success'
          : ''
      }
    >
      {/* 头部：昵称 + 状态 */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-[17px] font-medium text-text">{visitor.nickname}</div>
          <div className="text-xs text-text-secondary mt-1">
            {visitor.gender === '男' ? '♂' : '♀'} {visitor.gender} · {visitor.wechat} ·{' '}
            {formatTime(visitor.created_at)}
          </div>
        </div>
        <Tag status={visitor.status} />
      </div>

      {/* 自我介绍 */}
      {visitor.bio && (
        <div className="text-[13px] text-text-secondary my-2">{visitor.bio}</div>
      )}

      {/* 交友期许 */}
      {visitor.expectation && (
        <div className="text-[13px] text-text-secondary my-2">
          <span className="text-text-light">期许：</span>
          {visitor.expectation}
        </div>
      )}

      {/* 照片 */}
      {visitor.photos && visitor.photos.length > 0 && (
        <div className="my-2.5">
          <PhotoGrid
            value={visitor.photos}
            maxCount={3}
            locked={false}
          />
        </div>
      )}

      {/* 操作按钮 */}
      {visitor.status === 'pending' && (
        <div className="flex gap-2 mt-2.5">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            loading={acting}
            onClick={handleApprove}
          >
            同意解锁
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowRejectModal(true)}
          >
            拒绝
          </Button>
        </div>
      )}

      {visitor.status === 'approved' && (
        <div className="mt-2.5">
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            loading={acting}
            onClick={() => setShowRevokeModal(true)}
          >
            撤销权限
          </Button>
        </div>
      )}

      {/* 拒绝弹窗（含 allow_reapply 开关） */}
      <Modal
        open={showRejectModal}
        title={`确认拒绝 ${visitor.nickname}`}
        content={null}
        confirmText="确认拒绝"
        cancelText="取消"
        variant="danger"
        loading={acting}
        onCancel={() => setShowRejectModal(false)}
        onConfirm={handleReject}
      >
        {/* 自定义内容：allow_reapply 开关 */}
        <div className="mb-4">
          <div className="text-sm text-text-secondary mb-2">
            确定要拒绝该访客的申请吗？
          </div>
          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input
              type="checkbox"
              checked={allowReapply}
              onChange={(e) => setAllowReapply(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            允许该访客重新申请
          </label>
        </div>
      </Modal>

      {/* 撤销权限弹窗 */}
      <Modal
        open={showRevokeModal}
        title={`确认撤销 ${visitor.nickname} 的权限`}
        content="撤销后该访客将无法查看你的完整资料，此操作可恢复（重新审核通过即可）。"
        confirmText="确认撤销"
        cancelText="取消"
        variant="danger"
        loading={acting}
        onCancel={() => setShowRevokeModal(false)}
        onConfirm={handleRevoke}
      />
    </Card>
  );
}
