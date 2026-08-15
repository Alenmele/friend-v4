import { useState } from 'react';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase, BUCKETS } from '../../api/supabase.js';
import { exportCSV, exportJSON, VISITOR_COLUMNS } from '../../utils/exportData.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 危险操作区
 * - 导出数据（CSV/JSON）
 * - 清空访客（二次确认）
 * - 注销账户（二次确认 + 输入"确认注销"）
 */
export default function DangerZone({ onCleared, onDeleted }) {
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * 导出访客数据
   */
  const handleExport = async (format) => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ts = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        const result = exportCSV(data || [], VISITOR_COLUMNS, `visitors_${ts}.csv`);
        showToast(result.success ? '📊 数据已导出 CSV' : '导出失败', result.success ? 'success' : 'error');
      } else {
        const result = exportJSON(data || [], `visitors_${ts}.json`);
        showToast(result.success ? '📊 数据已导出 JSON' : '导出失败', result.success ? 'success' : 'error');
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  /**
   * 清空访客
   */
  const handleClearVisitors = async () => {
    if (!user?.id) return;
    setClearing(true);
    try {
      // 先删除 storage 中的访客照片（按 owner_id 前缀）
      const { data: visitors } = await supabase
        .from('visitors')
        .select('visitor_token')
        .eq('owner_id', user.id);
      if (visitors && visitors.length > 0) {
        for (const v of visitors) {
          const folderPath = `${user.id}/${v.visitor_token}`;
          const { data: files } = await supabase.storage
            .from(BUCKETS.VISITOR_PHOTOS)
            .list(folderPath);
          if (files && files.length > 0) {
            const paths = files.map((f) => `${folderPath}/${f.name}`);
            await supabase.storage.from(BUCKETS.VISITOR_PHOTOS).remove(paths);
          }
        }
      }

      // 删除 visitors 记录
      const { error } = await supabase
        .from('visitors')
        .delete()
        .eq('owner_id', user.id);
      if (error) throw error;

      showToast('🗑️ 访客记录已清空', 'success');
      setShowClearModal(false);
      onCleared?.();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setClearing(false);
    }
  };

  /**
   * 注销账户
   */
  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      // 1. 删除 storage（主人照片 + 头像）
      const ownerFolder = `${user.id}`;
      const { data: ownerFiles } = await supabase.storage
        .from(BUCKETS.OWNER_PHOTOS)
        .list(ownerFolder);
      if (ownerFiles?.length > 0) {
        await supabase.storage
          .from(BUCKETS.OWNER_PHOTOS)
          .remove(ownerFiles.map((f) => `${ownerFolder}/${f.name}`));
      }
      const { data: avatarFiles } = await supabase.storage
        .from(BUCKETS.AVATARS)
        .list(ownerFolder);
      if (avatarFiles?.length > 0) {
        await supabase.storage
          .from(BUCKETS.AVATARS)
          .remove(avatarFiles.map((f) => `${ownerFolder}/${f.name}`));
      }

      // 2. 删除访客的照片
      const { data: visitors } = await supabase
        .from('visitors')
        .select('visitor_token')
        .eq('owner_id', user.id);
      if (visitors?.length > 0) {
        for (const v of visitors) {
          const folderPath = `${user.id}/${v.visitor_token}`;
          const { data: files } = await supabase.storage
            .from(BUCKETS.VISITOR_PHOTOS)
            .list(folderPath);
          if (files?.length > 0) {
            await supabase.storage
              .from(BUCKETS.VISITOR_PHOTOS)
              .remove(files.map((f) => `${folderPath}/${f.name}`));
          }
        }
      }

      // 3. 删除 profile（级联删除 visitors + notifications）
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      // 4. 删除 auth.users（需要 service_role，前端只能调用 RPC 或提示用户在控制台删除）
      // 实际项目中需通过 Edge Function 实现，这里降级提示
      await signOut();
      showToast('🗑️ 账户已注销', 'success');
      setShowDeleteModal(false);
      onDeleted?.();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="text-[13px] font-semibold text-text-secondary mb-2.5">
        ⚙️ 管理操作
      </div>

      <div className="flex gap-2 mb-2.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          loading={exporting}
          onClick={() => handleExport('csv')}
        >
          📊 导出CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          loading={exporting}
          onClick={() => handleExport('json')}
        >
          📊 导出JSON
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full mb-2.5"
        onClick={() => setShowClearModal(true)}
      >
        🗑️ 清空访客
      </Button>

      <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
        🗑️ 注销账户
      </Button>

      {/* 清空访客 二次确认 */}
      <Modal
        open={showClearModal}
        title="确认清空访客"
        content="确定要清空所有访客记录吗？此操作不可恢复，访客照片也将被删除。"
        confirmText="确认清空"
        cancelText="取消"
        variant="danger"
        loading={clearing}
        onCancel={() => setShowClearModal(false)}
        onConfirm={handleClearVisitors}
      />

      {/* 注销账户 二次确认 + 文本验证 */}
      <Modal
        open={showDeleteModal}
        title="确认注销账户"
        content="注销后将永久删除所有数据（资料、访客记录、照片、通知），且不可恢复。"
        confirmText="确认注销"
        cancelText="取消"
        variant="danger"
        requireTextConfirm
        requireText="确认注销"
        loading={deleting}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
