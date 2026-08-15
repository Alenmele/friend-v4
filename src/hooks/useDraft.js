import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage.js';

/**
 * 表单草稿自动保存
 * - 7 天有效
 * - 防抖保存
 * - 恢复提示
 */
export function useDraft(linkId, initialForm) {
  const [form, setForm] = useState(initialForm);
  const [hasDraft, setHasDraft] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // 初始化时检查是否有有效草稿
  useEffect(() => {
    if (!linkId) return;
    if (storage.isDraftValid(linkId)) {
      const draft = storage.getDraft(linkId);
      if (draft) {
        setHasDraft(true);
        setShowRestorePrompt(true);
      }
    }
  }, [linkId]);

  // 表单变化时自动保存（防抖 800ms）
  useEffect(() => {
    if (!linkId) return;
    if (!hasDraft && Object.values(form).some((v) => v)) {
      // 表单有内容才保存
    }
    const timer = setTimeout(() => {
      const hasContent = Object.entries(form).some(([k, v]) => {
        if (k === '_savedAt') return false;
        if (Array.isArray(v)) return v.length > 0;
        return v !== '' && v !== null && v !== undefined;
      });
      if (hasContent) {
        storage.setDraft(linkId, form);
        setHasDraft(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [form, linkId, hasDraft]);

  // 恢复草稿
  const restoreDraft = useCallback(() => {
    const draft = storage.getDraft(linkId);
    if (draft) {
      const { _savedAt, ...formData } = draft;
      setForm({ ...initialForm, ...formData });
    }
    setShowRestorePrompt(false);
  }, [linkId, initialForm]);

  // 丢弃草稿
  const discardDraft = useCallback(() => {
    storage.clearDraft(linkId);
    setHasDraft(false);
    setShowRestorePrompt(false);
  }, [linkId]);

  // 更新表单字段
  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    form,
    setForm,
    updateField,
    hasDraft,
    showRestorePrompt,
    restoreDraft,
    discardDraft,
    clearDraft: () => storage.clearDraft(linkId),
  };
}
