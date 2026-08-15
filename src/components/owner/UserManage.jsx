import { useState, useEffect, useCallback } from 'react';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Modal from '../common/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 用户管理组件
 * - 新增用户（初始密码 Aa123456）
 * - 查看所有用户
 * - 删除用户
 * - 重置密码提示
 */
export default function UserManage() {
  const { showToast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [emailError, setEmailError] = useState('');

  // 拉取所有用户
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setUsers(parsed || []);
    } catch (err) {
      console.error('获取用户列表失败:', err.message);
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 新增用户
  const handleAddUser = async () => {
    // 校验邮箱
    const emailTrimmed = newEmail.trim();
    if (!emailTrimmed) {
      setEmailError('邮箱不能为空');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setEmailError('邮箱格式不正确');
      return;
    }

    // 检查邮箱是否已存在
    const exists = users.some((u) => u.email === emailTrimmed);
    if (exists) {
      setEmailError('该邮箱已被注册');
      return;
    }

    setAdding(true);
    setEmailError('');

    try {
      // 保存当前管理员的会话
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const adminAccessToken = adminSession?.access_token;
      const adminRefreshToken = adminSession?.refresh_token;

      if (!adminAccessToken || !adminRefreshToken) {
        throw new Error('无法获取当前会话，请重新登录');
      }

      // 调用 signUp 创建新用户（会切换到新用户会话）
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: 'Aa123456',
        options: {
          data: {
            nickname: newNickname.trim() || '新用户',
          },
        },
      });

      if (signUpError) throw signUpError;

      // 设置邮箱为已确认（通过 RPC 或直接在新用户记录上设置）
      // 注意：signUp 后会自动创建 profiles 记录（通过触发器）

      // 立即登出新用户
      await supabase.auth.signOut();

      // 恢复管理员会话
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: adminAccessToken,
        refresh_token: adminRefreshToken,
      });

      if (restoreError) {
        console.error('恢复管理员会话失败:', restoreError.message);
        showToast('用户已创建，但管理员会话已失效，请重新登录', 'error');
        return;
      }

      showToast(`✅ 用户 ${emailTrimmed} 创建成功，初始密码：Aa123456`, 'success');
      setShowAddModal(false);
      setNewEmail('');
      setNewNickname('');
      fetchUsers();
    } catch (err) {
      console.error('创建用户失败:', err.message);
      showToast(getErrorMessage(err), 'error');
      // 尝试恢复管理员会话
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          showToast('管理员会话已失效，请重新登录', 'error');
        }
      } catch (e) {
        // 忽略
      }
    } finally {
      setAdding(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!targetUser) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: targetUser.id,
      });
      if (error) throw error;
      showToast(`✅ 用户 ${targetUser.nickname} 已删除`, 'success');
      setShowDeleteModal(false);
      setTargetUser(null);
      fetchUsers();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // 重置密码提示
  const handleResetPassword = (u) => {
    showToast(`请前往 Supabase 控制台重置 ${u.nickname} 的密码为 Aa123456`, 'default', 4000);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] font-semibold text-text-secondary">
          👥 用户管理
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          ➕ 新增用户
        </Button>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-xs text-text-secondary">加载中...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center text-sm text-text-light py-6">
          暂无用户
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                u.id === user?.id
                  ? 'bg-primary-light border-primary'
                  : 'bg-surface border-border'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {u.nickname || '未设置'}
                  {u.id === user?.id && (
                    <span className="ml-2 text-[10px] text-primary font-semibold">当前账号</span>
                  )}
                </div>
                <div className="text-xs text-text-secondary truncate mt-0.5">
                  {u.email}
                </div>
                <div className="text-[11px] text-text-light mt-0.5">
                  {u.gender} · {u.age}岁 · {u.wechat || '未填微信号'}
                </div>
              </div>
              <div className="flex gap-1.5 ml-2 flex-shrink-0">
                <button
                  onClick={() => handleResetPassword(u)}
                  className="text-[11px] px-2 py-1 rounded-lg bg-surface-muted text-text-secondary hover:bg-border transition cursor-pointer border-none"
                  title="重置密码"
                >
                  🔑
                </button>
                {u.id !== user?.id && (
                  <button
                    onClick={() => {
                      setTargetUser(u);
                      setShowDeleteModal(true);
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg bg-red-50 text-danger hover:bg-red-100 transition cursor-pointer border-none"
                    title="删除用户"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增用户弹窗 */}
      <Modal
        open={showAddModal}
        title="新增用户"
        content={null}
        confirmText="确认创建"
        cancelText="取消"
        variant="primary"
        loading={adding}
        onCancel={() => {
          setShowAddModal(false);
          setNewEmail('');
          setNewNickname('');
          setEmailError('');
        }}
        onConfirm={handleAddUser}
      >
        <div className="mb-4">
          <Input
            label="邮箱"
            required
            type="email"
            placeholder="请输入新用户邮箱"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setEmailError('');
            }}
            error={emailError}
          />
          <div className="mt-3">
            <Input
              label="昵称（可选）"
              placeholder="请输入昵称"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="mt-3 px-3 py-2 bg-primary-light rounded-lg text-xs text-text-secondary">
            💡 初始密码为 <strong>Aa123456</strong>，用户登录后可自行修改
          </div>
        </div>
      </Modal>

      {/* 删除用户确认弹窗 */}
      <Modal
        open={showDeleteModal}
        title="确认删除用户"
        content={`确定要删除用户 ${targetUser?.nickname || ''}（${targetUser?.email || ''}）吗？此操作将删除该用户的所有数据，且不可恢复。`}
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
        loading={deleting}
        onCancel={() => {
          setShowDeleteModal(false);
          setTargetUser(null);
        }}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
