import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * 图片放大查看模态框
 * - 全屏遮罩，居中显示原图
 * - 支持左右切换多张照片
 * - 点击空白处或 ESC 关闭
 *
 * @param {boolean} open - 是否打开
 * @param {string[]} images - 图片 URL 数组
 * @param {number} index - 当前图片索引
 * @param {function} onClose - 关闭回调
 * @param {function} onIndexChange - 索引变更回调 (newIndex) => void
 */
export default function ImageModal({ open, images = [], index = 0, onClose, onIndexChange }) {
  const handlePrev = useCallback((e) => {
    e?.stopPropagation();
    onIndexChange?.((index - 1 + images.length) % images.length);
  }, [index, images.length, onIndexChange]);

  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    onIndexChange?.((index + 1) % images.length);
  }, [index, images.length, onIndexChange]);

  // ESC 关闭 / 左右切换
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, handlePrev, handleNext]);

  if (!open || images.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center hover:bg-white/30 transition z-10"
        aria-label="关闭"
      >
        ✕
      </button>

      {/* 计数器 */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/20 text-white text-sm">
          {index + 1} / {images.length}
        </div>
      )}

      {/* 左箭头 */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center hover:bg-white/30 transition z-10"
          aria-label="上一张"
        >
          ‹
        </button>
      )}

      {/* 图片 */}
      <img
        src={images[index]}
        alt={`照片 ${index + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* 右箭头 */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center hover:bg-white/30 transition z-10"
          aria-label="下一张"
        >
          ›
        </button>
      )}
    </div>,
    document.body
  );
}
