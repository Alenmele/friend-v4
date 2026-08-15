import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateEmail, validatePassword } from '../utils/validators.js';
import { getErrorMessage } from '../utils/errorMap.js';

/**
 * 主人登录页 /login
 */
export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    // 校验
    const errs = {};
    const e1 = validateEmail(email);
    if (e1) errs.email = e1;
    const e2 = validatePassword(password);
    if (e2) errs.password = e2;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.success) {
        showToast('✅ 登录成功', 'success');
        navigate('/dashboard');
      } else {
        showToast(getErrorMessage(result.error), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <div className="phone-body">
          {/* 品牌头部 */}
          <div className="text-center pt-6 pb-5">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl text-white shadow-primary"
              style={{ background: 'linear-gradient(135deg, #93c5fd, var(--primary))' }}
            >
              👋
            </div>
            <div className="text-xl font-bold text-text">Friend Card V4</div>
            <div className="text-xs text-text-secondary mt-1 flex items-center justify-center gap-1.5 flex-wrap">
              <span>管理分发版</span>
              <span className="bg-warning text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                访客免登录
              </span>
              <span className="bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                v4.0-lite
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4">
            <Input
              label="邮箱"
              required
              type="email"
              placeholder="请输入主人邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            <Input
              label="密码"
              required
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />

            <Button
              variant="primary"
              type="submit"
              loading={loading}
              className="mt-2"
            >
              登 录
            </Button>
          </form>

          <div className="text-center text-xs text-text-light mt-4 leading-relaxed">
            主人账号由系统预设<br />访客无需登录，通过专属链接访问
          </div>
        </div>
      </div>
    </div>
  );
}
