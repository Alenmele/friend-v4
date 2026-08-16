import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar.jsx';
import Input from '../common/Input.jsx';
import Textarea from '../common/Textarea.jsx';
import RadioGroup from '../common/RadioGroup.jsx';
import PhotoGrid from '../common/PhotoGrid.jsx';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDraft } from '../../hooks/useDraft.js';
import { validateVisitorForm } from '../../utils/validators.js';
import { supabase, BUCKETS } from '../../api/supabase.js';
import { compressImage, generateFilename, blobToFile } from '../../utils/imageCompress.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 访客填写表单
 */
export default function VisitorForm({ ownerProfile, visitorToken, onSubmit, onCancel }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const qrFileRef = useRef(null);

  const initialForm = {
    nickname: '',
    gender: '男',
    wechat: '',
    wechat_qr: '', // 微信号二维码截图URL
    bio: '',
    expectation: '',
    photos: [],
  };

  const {
    form,
    updateField,
    showRestorePrompt,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useDraft(ownerProfile?.link_id, initialForm);

  /**
   * 上传访客照片到 storage
   */
  const handleUploadPhoto = async (file, filename) => {
    if (!ownerProfile || !visitorToken) throw new Error('上下文缺失');
    const path = `${ownerProfile.id}/${visitorToken}/${filename}`;
    const { error } = await supabase.storage
      .from(BUCKETS.VISITOR_PHOTOS)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage
      .from(BUCKETS.VISITOR_PHOTOS)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  /**
   * 仅缩放二维码图片（保留 PNG 透明/WebP，不强制 JPEG 白背景，不破坏二维码识别）
   */
  const compressQrImage = async (file, options = {}) => {
    const { maxSize = 1024, quality = 0.92 } = options;
    const img = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('二维码图片加载失败'));
        im.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('二维码图片读取失败'));
      reader.readAsDataURL(file);
    });
    let { width, height } = img;
    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // 透明保留：不填充白背景（png/webp 保持透明）
    ctx.drawImage(img, 0, 0, width, height);
    const mimeType =
      file.type === 'image/png' ? 'image/png' :
      file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    if (mimeType === 'image/jpeg') {
      // JPEG 无透明通道，需先填充白背景再画，避免黑色底
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('二维码图片处理失败'));
        },
        mimeType,
        quality
      );
    });
  };

  /**
   * 校验是否为微信号二维码截图（比例放宽：手机全屏微信截图通常为 9:16 ≈ 1.78）
   */
  const validateQrImage = (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('请上传图片格式的二维码'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('二维码图片不能超过 5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const { width, height } = img;
          // 放宽比例到 0.5-2.0，兼容 9:16/16:9 手机截图带微信导航栏
          const ratio = Math.max(width, height) / Math.min(width, height);
          if (ratio > 2.0) {
            reject(new Error('二维码图片比例异常，请裁剪后重新上传'));
            return;
          }
          // 最小分辨率
          if (width < 200 || height < 200) {
            reject(new Error('二维码图片太小，请上传清晰的微信二维码截图'));
            return;
          }
          resolve({ width, height });
        };
        img.onerror = () => reject(new Error('图片损坏，无法识别，请重新上传'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('图片读取失败，请重试'));
      reader.readAsDataURL(file);
    });
  };

  /**
   * 上传微信号二维码截图
   */
  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setQrUploading(true);
    try {
      await validateQrImage(file);
      // 二维码专用压缩：保留 PNG/WebP 透明，不强制 JPEG 白背景
      const compressedBlob = await compressQrImage(file, { maxSize: 1024, quality: 0.92 });
      const ext =
        file.type === 'image/png' ? '.png' :
        file.type === 'image/webp' ? '.webp' : '.jpg';
      const filename = 'wechat_qr_' + generateFilename(ext);
      const compressedFile = blobToFile(compressedBlob, filename);
      if (!ownerProfile || !visitorToken) throw new Error('上下文缺失');
      const path = `${ownerProfile.id}/${visitorToken}/${filename}`;
      const { error } = await supabase.storage
        .from(BUCKETS.VISITOR_PHOTOS)
        .upload(path, compressedFile, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage
        .from(BUCKETS.VISITOR_PHOTOS)
        .getPublicUrl(path);
      updateField('wechat_qr', data.publicUrl);
      setErrors((prev) => { const n = { ...prev }; delete n.wechat_qr; return n; });
      showToast('✅ 二维码上传成功', 'success');
    } catch (err) {
      console.error('二维码上传失败:', err);
      showToast(getErrorMessage(err) || err.message || '二维码上传失败，请重试', 'error');
    } finally {
      setQrUploading(false);
    }
  };

  /**
   * 删除二维码
   */
  const handleRemoveQr = () => {
    updateField('wechat_qr', '');
  };

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    // 校验
    const errs = validateVisitorForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('请完善表单信息', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(form);
      if (result?.success) {
        showToast('✅ 申请已提交，等待主人审核', 'success');
        clearDraft();
      } else {
        showToast(getErrorMessage(result?.error), 'error');
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="phone-body">
      <Navbar
        title="填写信息互换"
        onBack={() => setShowCancelConfirm(true)}
      />

      {/* 提示卡 */}
      <div
        className="bg-primary-light rounded-xl px-4 py-3 mb-4 text-[13px] text-text-secondary"
      >
        填写你的资料，提交后等待 <strong>{ownerProfile?.nickname}</strong> 审核通过，即可查看对方完整信息
      </div>

      {/* 草稿恢复提示 */}
      {showRestorePrompt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-[13px]">
          <div className="text-amber-700 mb-2">💾 检测到未完成的草稿，是否继续填写？</div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={restoreDraft}>
              继续填写
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={discardDraft}>
              重新开始
            </Button>
          </div>
        </div>
      )}

      <Input
        label="昵称"
        required
        placeholder="请输入你的昵称"
        value={form.nickname}
        onChange={(e) => updateField('nickname', e.target.value)}
        error={errors.nickname}
        maxLength={20}
      />

      <div className="field mb-4">
        <div className="field-label text-sm font-medium text-text mb-1.5">
          性别 <span className="text-danger ml-0.5">*</span>
        </div>
        <RadioGroup
          options={[
            { value: '男', label: '男' },
            { value: '女', label: '女' },
          ]}
          value={form.gender}
          onChange={(v) => updateField('gender', v)}
        />
        {errors.gender && (
          <div className="text-danger text-xs mt-1 ml-4">{errors.gender}</div>
        )}
      </div>

      {/* 微信号二维码截图上传 */}
      <div className="field mb-4">
        <div className="field-label text-sm font-medium text-text mb-1.5">
          微信号二维码截图 <span className="text-danger ml-0.5">*</span>
          <span className="text-xs text-text-light ml-2">上传微信二维码，方便主人加你好友</span>
        </div>
        {form.wechat_qr ? (
          <div className="relative inline-block">
            <img
              src={form.wechat_qr}
              alt="微信号二维码"
              className="w-40 h-40 rounded-lg object-cover border border-border shadow-sm"
            />
            <button
              type="button"
              onClick={handleRemoveQr}
              className="absolute -top-2 -right-2 w-7 h-7 bg-danger text-white rounded-full text-sm leading-none flex items-center justify-center shadow"
              title="删除二维码"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="block">
            <input
              ref={qrFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrUpload}
            />
            <div
              className="w-40 h-40 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-text-light cursor-pointer hover:border-primary hover:bg-primary-light transition"
              onClick={() => qrFileRef.current?.click()}
            >
              {qrUploading ? (
                <>
                  <div className="text-2xl mb-1">⏳</div>
                  <div className="text-xs">上传中...</div>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-1">📱</div>
                  <div className="text-xs">点击上传二维码</div>
                </>
              )}
            </div>
          </label>
        )}
        {errors.wechat_qr && (
          <div className="text-danger text-xs mt-1.5 ml-1">{errors.wechat_qr}</div>
        )}
      </div>

      <Textarea
        label="自我介绍"
        required
        placeholder="简单介绍一下自己吧"
        value={form.bio}
        onChange={(e) => updateField('bio', e.target.value)}
        error={errors.bio}
        maxLength={500}
      />

      <Textarea
        label="交友期许"
        required
        placeholder="你期待什么样的朋友？"
        value={form.expectation}
        onChange={(e) => updateField('expectation', e.target.value)}
        error={errors.expectation}
        maxLength={500}
      />

      <div className="field mb-4">
        <div className="field-label text-sm font-medium text-text mb-1.5">
          个人照片（1-3张） <span className="text-danger ml-0.5">*</span>
        </div>
        <PhotoGrid
          value={form.photos}
          onChange={(urls) => updateField('photos', urls)}
          maxCount={3}
          onUpload={handleUploadPhoto}
        />
        {errors.photos && (
          <div className="text-danger text-xs mt-1 ml-4">{errors.photos}</div>
        )}
      </div>

      <div className="text-xs text-text-secondary text-center mb-4 leading-relaxed">
        💡 提交后对方会看到你的信息，审核通过后<br />你才能看到对方的完整资料哦~
      </div>

      <Button
        variant="primary"
        loading={submitting}
        onClick={handleSubmit}
      >
        提 交 申 请
      </Button>

      <Button
        variant="outline"
        className="mt-2.5"
        onClick={() => setShowCancelConfirm(true)}
      >
        取 消
      </Button>

      <div
        className="mt-4 px-3.5 py-2.5 bg-primary-light rounded-xl text-xs text-text-secondary text-center border border-primary-light"
      >
        💾 草稿自动保存 · 7天有效
      </div>

      <Modal
        open={showCancelConfirm}
        title="确认取消"
        content="取消后表单内容仍会保存为草稿，下次可继续填写。确认要取消吗？"
        confirmText="确认取消"
        cancelText="继续填写"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false);
          onCancel?.();
        }}
      />
    </div>
  );
}
