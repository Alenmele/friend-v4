import { useState } from 'react';
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
import { generateFilename } from '../../utils/imageCompress.js';

/**
 * 访客填写表单
 */
export default function VisitorForm({ ownerProfile, visitorToken, onSubmit, onCancel }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const initialForm = {
    nickname: '',
    gender: '男',
    wechat: '',
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
        showToast(result?.error || '提交失败，请重试', 'error');
      }
    } catch (err) {
      showToast(err.message || '提交失败', 'error');
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

      <Input
        label="微信号"
        required
        placeholder="请输入你的微信号"
        value={form.wechat}
        onChange={(e) => updateField('wechat', e.target.value)}
        error={errors.wechat}
        maxLength={20}
      />

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
