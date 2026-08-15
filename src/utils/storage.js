import { STORAGE_KEYS } from '../api/supabase.js';

/**
 * localStorage 封装
 * - 安全的 JSON 读写
 * - 异常捕获
 */

export const storage = {
  /**
   * 读取字符串
   */
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error('localStorage 读取失败:', err.message);
      return null;
    }
  },

  /**
   * 写入字符串
   */
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error('localStorage 写入失败:', err.message);
      return false;
    }
  },

  /**
   * 读取 JSON
   */
  getJSON(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (err) {
      console.error('localStorage JSON 读取失败:', err.message);
      return defaultValue;
    }
  },

  /**
   * 写入 JSON
   */
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('localStorage JSON 写入失败:', err.message);
      return false;
    }
  },

  /**
   * 删除
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error('localStorage 删除失败:', err.message);
    }
  },

  /**
   * 获取或生成访客 token（全局唯一）
   */
  getOrCreateVisitorToken() {
    let token = this.get(STORAGE_KEYS.VISITOR_TOKEN);
    if (!token) {
      // 生成 UUID v4
      token = this.generateUUID();
      this.set(STORAGE_KEYS.VISITOR_TOKEN, token);
    }
    return token;
  },

  /**
   * 生成 UUID v4
   */
  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // 兼容性回退
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * 获取访客在某链接下的状态
   */
  getVisitorStatus(linkId) {
    return this.getJSON(STORAGE_KEYS.VISITOR_STATUS(linkId), null);
  },

  /**
   * 设置访客在某链接下的状态
   */
  setVisitorStatus(linkId, status, submittedAt = Date.now()) {
    this.setJSON(STORAGE_KEYS.VISITOR_STATUS(linkId), { status, submittedAt });
  },

  /**
   * 清除访客在某链接下的状态
   */
  clearVisitorStatus(linkId) {
    this.remove(STORAGE_KEYS.VISITOR_STATUS(linkId));
  },

  /**
   * 获取表单草稿
   */
  getDraft(linkId) {
    return this.getJSON(STORAGE_KEYS.DRAFT(linkId), null);
  },

  /**
   * 保存表单草稿（含 7 天有效期校验）
   */
  setDraft(linkId, data) {
    const payload = { ...data, _savedAt: Date.now() };
    this.setJSON(STORAGE_KEYS.DRAFT(linkId), payload);
  },

  /**
   * 清除草稿
   */
  clearDraft(linkId) {
    this.remove(STORAGE_KEYS.DRAFT(linkId));
  },

  /**
   * 校验草稿是否在 7 天有效期内
   */
  isDraftValid(linkId) {
    const draft = this.getDraft(linkId);
    if (!draft?._savedAt) return false;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - draft._savedAt < SEVEN_DAYS;
  },
};
