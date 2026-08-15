/**
 * 图片压缩工具
 * PRD 要求：照片 jpg/png/webp，单张 ≤5MB，前端压缩至 1024px
 */

/**
 * 压缩图片
 * @param {File} file 原始文件
 * @param {Object} options
 * @param {number} options.maxSize 最大边长，默认 1024
 * @param {number} options.quality 压缩质量 0-1，默认 0.85
 * @param {string} options.mimeType 输出 mime，默认 image/jpeg
 * @returns {Promise<Blob>} 压缩后的 Blob
 */
export async function compressImage(file, options = {}) {
  const { maxSize = 1024, quality = 0.85, mimeType = 'image/jpeg' } = options;

  // 校验文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('仅支持 jpg/png/webp 格式');
  }

  // 校验文件大小（≤5MB）
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('单张照片不能超过 5MB');
  }

  // 读取为 Image
  const img = await loadImage(file);

  // 计算缩放后尺寸
  let { width, height } = img;
  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  // 绘制到 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // JPEG 不支持透明，填充白色背景
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 输出 Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片压缩失败'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * 加载 File 为 Image 对象
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * Blob 转 File
 */
export function blobToFile(blob, filename) {
  return new File([blob], filename, { type: blob.type });
}

/**
 * 生成上传文件名
 * @param {string} ext 扩展名（如 .jpg）
 */
export function generateFilename(ext = '.jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}_${rand}${ext}`;
}
