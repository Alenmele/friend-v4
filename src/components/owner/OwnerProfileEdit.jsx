import { useState, useEffect } from 'react';
import Input from '../common/Input.jsx';
import Textarea from '../common/Textarea.jsx';
import RadioGroup from '../common/RadioGroup.jsx';
import PhotoGrid from '../common/PhotoGrid.jsx';
import Button from '../common/Button.jsx';
import ImageModal from '../common/ImageModal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase, BUCKETS } from '../../api/supabase.js';
import { validateProfileForm } from '../../utils/validators.js';
import { generateFilename } from '../../utils/imageCompress.js';
import { getErrorMessage } from '../../utils/errorMap.js';

/**
 * 主人资料编辑
 * 7 项：昵称/性别/年龄/微信号/自我介绍/交友期许/照片（含头像选取）
 */
export default function OwnerProfileEdit({ onSaved }) {
  const { profile, user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    nickname: '',
    gender: '男',
    age: '',
    wechat: '',
    bio: '',
    expectation: '',
    photos: [],
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [imageModal, setImageModal] = useState({ open: false, index: 0 });

  // 初始化表单
  useEffect(() => {
    if (profile) {
      setForm({
        nickname: profile.nickname || '',
        gender: profile.gender || '男',
        age: profile.age || '',
        wechat: profile.wechat || '',
        bio: profile.bio || '',
        expectation: profile.expectation || '',
        photos: profile.photos || [],
      });
    }
  }, [profile]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 上传主人照片
   */
  const handleUploadPhoto = async (file, filename) => {
    if (!user?.id) throw new Error('用户未登录');
    const path = `${user.id}/${filename}`;
    const { error } = await supabase.storage
      .from(BUCKETS.OWNER_PHOTOS)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage
      .from(BUCKETS.OWNER_PHOTOS)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  /**
   * 保存资料
   */
  const handleSave = async () => {
    // 校验
    const errs = validateProfileForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('请完善所有必填项', 'error');
      return;
    }

    setSaving(true);
    try {
      // 头像统一使用第二张照片（若存在），没有第二张则回退到第一张
      const avatarPic = form.photos[1] || form.photos[0] || null;
      const updateData = {
        nickname: form.nickname.trim(),
        gender: form.gender,
        age: Number(form.age),
        wechat: form.wechat.trim(),
        bio: form.bio.trim(),
        expectation: form.expectation.trim(),
        photos: form.photos,
        avatar: avatarPic,
        updated_at: new Date().toISOString(),
      };

      // 直接更新（RLS 策略已授权 authenticated 用户可更新自己的行）
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('[profiles.update] 方式1直接更新失败:', JSON.stringify(error));
        throw error;
      }

      // 首次保存：生成 link_id
      if (!profile?.link_id) {
        const { error: linkErr } = await supabase.rpc('generate_link_id', {
          p_user_id: user.id,
        });
        if (linkErr) throw linkErr;
      }

      await refreshProfile();
      showToast('💾 资料已保存', 'success');
      onSaved?.();
    } catch (err) {
      console.error('保存失败:', err);
      const errMsg = err?.message || err?.error || String(err);
      showToast('保存失败：' + errMsg, 'error', 6000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Input
        label="昵称"
        required
        placeholder="请输入昵称"
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
      </div>

      <Input
        label="年龄"
        required
        type="number"
        placeholder="请输入年龄（≥18）"
        value={form.age}
        onChange={(e) => updateField('age', e.target.value)}
        error={errors.age}
        min={18}
        max={120}
      />

      <Input
        label="微信号"
        required
        placeholder="请输入微信号"
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
          <span className="text-xs text-text-light ml-2">第二张作为头像（推荐）</span>
        </div>
        <PhotoGrid
          value={form.photos}
          onChange={(urls) => updateField('photos', urls)}
          maxCount={3}
          onUpload={handleUploadPhoto}
          onPhotoClick={(i) => setImageModal({ open: true, index: i })}
        />
        {errors.photos && (
          <div className="text-danger text-xs mt-1 ml-4">{errors.photos}</div>
        )}
      </div>

      <Button variant="primary" loading={saving} onClick={handleSave}>
        💾 保存资料
      </Button>

      {/* 图片放大查看 */}
      <ImageModal
        open={imageModal.open}
        images={form.photos || []}
        index={imageModal.index}
        onClose={() => setImageModal({ open: false, index: 0 })}
        onIndexChange={(i) => setImageModal({ open: true, index: i })}
      />
    </>
  );
}
