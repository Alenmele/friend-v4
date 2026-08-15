import { useEffect } from 'react';
import Button from './Button.jsx';

/**
 * Modal 二次确认弹窗
 *
 * @param {boolean} open - 是否显示
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {string} confirmText - 确认按钮文字
 * @param {string} cancelText - 取消按钮文字
 * @param {string} variant - confirm 按钮样式：primary | danger
 * @param {boolean} requireTextConfirm - 是否需要输入文本验证
 * @param {string} requireText - 需要输入的验证文本
 * @param {function} onConfirm
 * @param {function} onCancel
 */
export default function Modal({
  open,
  title,
  content,
  children,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'primary',
  requireTextConfirm = false,
  requireText = '',
  onConfirm,
  onCancel,
}) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-card w-full max-w-sm p-5 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-text mb-2">{title}</div>
        {content && (
          <div className="text-sm text-text-secondary mb-4 leading-relaxed whitespace-pre-line">
            {content}
          </div>
        )}
        {children && <div className="mb-4">{children}</div>}

        {requireTextConfirm && (
          <div className="mb-4">
            <div className="text-xs text-text-secondary mb-2">
              请输入 <span className="text-danger font-semibold">{requireText}</span> 以确认操作
            </div>
            <input
              id="modal-text-confirm"
              type="text"
              className="input-box"
              placeholder={`请输入"${requireText}"`}
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            size="sm"
            className="flex-1"
            onClick={() => {
              if (requireTextConfirm) {
                const val = document.getElementById('modal-text-confirm')?.value;
                if (val !== requireText) {
                  return; // 文本不匹配，不执行
                }
              }
              onConfirm?.();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
