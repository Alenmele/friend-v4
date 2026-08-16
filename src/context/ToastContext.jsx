import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

/**
 * Toast 全局上下文
 * 用法: const { showToast } = useToast();
 *   showToast('消息')                  // 默认
 *   showToast('成功', 'success')       // 绿色
 *   showToast('失败', 'error')         // 红色
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(typeof document !== 'undefined');
  }, []);

  const showToast = useCallback((message, type = 'default', duration = 2500) => {
    const id = Date.now() + Math.random();
    // 调式日志：便于排查 showToast 是否被实际调用
    if (typeof console !== 'undefined') {
      console.log('[showToast]', type, message);
    }
    setToasts((prev) => [...prev, { id, message, type }]);

    // 自动移除
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastContainer = (
    <div
      className="toast-container"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-item ${t.type}`}
          onClick={() => removeToast(t.id)}
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          {t.message}
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 使用 Portal 将 Toast 挂到 body，避免被父级 overflow / 层叠上下文截断 */}
      {mounted && typeof document !== 'undefined' && document.body
        ? createPortal(toastContainer, document.body)
        : toastContainer}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}
