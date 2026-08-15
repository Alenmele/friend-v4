import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button.jsx';

/**
 * 404 页面
 */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="app-wrapper">
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <div className="phone-body">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-2xl font-bold text-text mb-2">404</div>
            <div className="text-sm text-text-secondary mb-6">
              页面不存在或链接已失效
            </div>
            <Button variant="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
