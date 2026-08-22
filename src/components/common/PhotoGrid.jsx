import { useRef, useState } from 'react';
import { compressImage, blobToFile, generateFilename } from '../../utils/imageCompress.js';

/**
 * PhotoGrid 照片网格
 * - 支持上传（含压缩至 1024px）
 * - 动态显示：已上传 + 剩余空位（最多 maxCount 张）
 * - 锁定状态
 * - 只读模式：显示照片但无添加/删除按钮，支持点击放大
 * - 进度环
 *
 * @param {Array} value - 已上传照片 URL 数组
 * @param {function} onChange - (newUrls) => void
 * @param {number} maxCount - 最大张数，默认 3
 * @param {boolean} locked - 是否锁定（显示🔒图标）
 * @param {boolean} readonly - 只读浏览模式（显示照片但无添加/删除）
 * @param {function} onUpload - 自定义上传函数 (file, filename) => Promise<url>
 * @param {function} onPhotoClick - 点击照片回调 (index) => void
 */
export default function PhotoGrid({
  value = [],
  onChange,
  maxCount = 3,
  locked = false,
  readonly = false,
  onUpload,
  onPhotoClick,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClick = () => {
    if (locked || readonly || uploading) return;
    if (value.length >= maxCount) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setProgress(0);
    try {
      setProgress(30);
      const compressedBlob = await compressImage(file, { maxSize: 1024, quality: 0.85 });
      setProgress(70);

      const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
      const filename = generateFilename(ext);
      const compressedFile = blobToFile(compressedBlob, filename);

      let url;
      if (onUpload) {
        url = await onUpload(compressedFile, filename);
      } else {
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
            {!locked && !readonly && (
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

        {/* 只读模式：不显示添加按钮 */}
        {!readonly && !uploading &&
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

      {!readonly && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {!readonly && (
        <div className="text-[11px] text-text-light mt-1.5">
          支持 jpg / png / webp，单张 ≤5MB
        </div>
      )}
    </>
  );
}
