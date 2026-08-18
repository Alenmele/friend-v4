import { useRef, useState } from 'react';
import { compressImage, blobToFile, generateFilename } from '../../utils/imageCompress.js';

/**
 * PhotoGrid 照片网格
 * - 支持上传（含压缩至 1024px）
 * - 动态显示：已上传 + 剩余空位（最多 maxCount 张）
 * - 锁定状态
 * - 进度环
 *
 * @param {Array} value - 已上传照片 URL 数组
 * @param {function} onChange - (newUrls) => void
 * @param {number} maxCount - 最大张数，默认 3
 * @param {boolean} locked - 是否锁定
 * @param {function} onUpload - 自定义上传函数 (file, filename) => Promise<url>
 */
export default function PhotoGrid({
  value = [],
  onChange,
  maxCount = 3,
  locked = false,
  onUpload,
  onPhotoClick,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClick = () => {
    if (locked || uploading) return;
    if (value.length >= maxCount) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // 重置以便重复选择同一文件

    setUploading(true);
    setProgress(0);
    try {
      // 压缩
      setProgress(30);
      const compressedBlob = await compressImage(file, { maxSize: 1024, quality: 0.85 });
      setProgress(70);

      // 获取扩展名
      const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
      const filename = generateFilename(ext);
      const compressedFile = blobToFile(compressedBlob, filename);

      // 上传
      let url;
      if (onUpload) {
        url = await onUpload(compressedFile, filename);
      } else {
        // 默认占位（无后端时返回本地预览 URL）
        url = URL.createObjectURL(compressedBlob);
      }
      setProgress(100);

      onChange?.([...value, url]);
    } catch (err) {
      console.error('上传失败:', err.message);
      alert(err.message || '照片上传失败，请重试');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = (index) => {
    const next = value.filter((_, i) => i !== index);
    onChange?.(next);
  };

  // 锁定状态：显示 maxCount 个锁
  if (locked) {
    return (
      <div className="photo-grid grid grid-cols-3 gap-2.5">
        {Array.from({ length: maxCount }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-surface-muted rounded-2xl border border-border flex items-center justify-center text-text-light text-xl"
          >
            🔒
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="photo-grid grid grid-cols-3 gap-2.5">
        {/* 已上传 */}
        {value.map((url, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl border border-border overflow-hidden relative group bg-surface-muted"
          >
            <img
              src={url}
              alt={`照片${i + 1}`}
              className={`w-full h-full object-cover ${onPhotoClick ? 'cursor-zoom-in' : ''}`}
              onClick={onPhotoClick ? () => onPhotoClick(i) : undefined}
            />
            {!locked && (
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                aria-label="删除照片"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* 上传中占位（带进度环） */}
        {uploading && (
          <div className="aspect-square rounded-2xl border border-dashed border-border-strong bg-surface-muted flex items-center justify-center">
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="#e6eaef" strokeWidth="3" />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="#4a8eff"
                  strokeWidth="3"
                  strokeDasharray={`${(progress / 100) * 88} 88`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* 剩余空位 */}
        {!uploading &&
          value.length < maxCount &&
          Array.from({ length: maxCount - value.length }).map((_, i) => (
            <button
              type="button"
              key={`empty-${i}`}
              onClick={handleClick}
              className="aspect-square rounded-2xl border border-dashed border-border-strong bg-surface-muted flex items-center justify-center text-text-light text-2xl hover:border-primary hover:text-primary transition cursor-pointer"
              aria-label="上传照片"
            >
              ➕
            </button>
          ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="text-[11px] text-text-light mt-1.5">
        支持 jpg / png / webp，单张 ≤5MB
      </div>
    </>
  );
}
