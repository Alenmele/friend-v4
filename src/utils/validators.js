/**
 * 参数校验工具
 */

/**
 * 校验昵称
 * 规则：1-20 字符
 */
export function validateNickname(name) {
  if (!name || typeof name !== 'string') return '昵称不能为空';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '昵称不能为空';
  if (trimmed.length > 20) return '昵称不能超过 20 个字符';
  return null;
}

/**
 * 校验性别
 */
export function validateGender(gender) {
  if (!gender) return '请选择性别';
  if (!['男', '女'].includes(gender)) return '性别参数非法';
  return null;
}

/**
 * 校验年龄
 * 规则：18-120
 */
export function validateAge(age) {
  if (age === null || age === undefined || age === '') return '年龄不能为空';
  const num = Number(age);
  if (Number.isNaN(num)) return '年龄必须是数字';
  if (!Number.isInteger(num)) return '年龄必须是整数';
  if (num < 18) return '年龄必须 ≥ 18';
  if (num > 120) return '年龄必须 ≤ 120';
  return null;
}

/**
 * 校验微信号（用于主人资料）
 * 规则：6-20 位，字母开头，允许字母数字下划线减号
 */
export function validateWechat(wechat) {
  if (!wechat || typeof wechat !== 'string') return '微信号不能为空';
  const trimmed = wechat.trim();
  if (trimmed.length < 6) return '微信号至少 6 位';
  if (trimmed.length > 20) return '微信号不能超过 20 位';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(trimmed)) {
    return '微信号需以字母开头，仅支持字母数字下划线减号';
  }
  return null;
}

/**
 * 校验微信号二维码截图（用于访客申请）
 * 规则：必须是非空 URL
 */
export function validateWechatQr(qrUrl) {
  if (!qrUrl || typeof qrUrl !== 'string') return '请上传微信号二维码截图';
  const trimmed = qrUrl.trim();
  if (trimmed.length === 0) return '请上传微信号二维码截图';
  if (!/^https?:\/\//i.test(trimmed)) return '二维码图片上传失败，请重试';
  return null;
}

/**
 * 校验自我介绍
 * 规则：非空，最长 500 字
 */
export function validateBio(bio) {
  if (!bio || typeof bio !== 'string') return '自我介绍不能为空';
  const trimmed = bio.trim();
  if (trimmed.length === 0) return '自我介绍不能为空';
  if (trimmed.length > 500) return '自我介绍不能超过 500 字';
  return null;
}

/**
 * 校验交友期许
 * 规则：非空，最长 500 字
 */
export function validateExpectation(exp) {
  if (!exp || typeof exp !== 'string') return '交友期许不能为空';
  const trimmed = exp.trim();
  if (trimmed.length === 0) return '交友期许不能为空';
  if (trimmed.length > 500) return '交友期许不能超过 500 字';
  return null;
}

/**
 * 校验照片数组
 * 规则：1-3 张
 */
export function validatePhotos(photos) {
  if (!Array.isArray(photos)) return '照片数据格式错误';
  if (photos.length === 0) return '请至少上传 1 张照片';
  if (photos.length > 3) return '最多上传 3 张照片';
  return null;
}

/**
 * 校验 link_id
 * 规则：8 位
 */
export function validateLinkId(linkId) {
  if (!linkId) return '链接ID不能为空';
  if (typeof linkId !== 'string') return '链接ID格式错误';
  if (linkId.length !== 8) return '链接ID必须为 8 位';
  if (!/^[a-zA-Z0-9]+$/.test(linkId)) return '链接ID格式非法';
  return null;
}

/**
 * 校验邮箱
 */
export function validateEmail(email) {
  if (!email) return '邮箱不能为空';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return '邮箱格式不正确';
  return null;
}

/**
 * 校验密码
 * 规则：至少 6 位
 */
export function validatePassword(password) {
  if (!password) return '密码不能为空';
  if (password.length < 6) return '密码至少 6 位';
  return null;
}

/**
 * 校验访客表单（6 项必填 + 微信号二维码）
 */
export function validateVisitorForm(form) {
  const errors = {};
  const e1 = validateNickname(form.nickname);
  if (e1) errors.nickname = e1;
  const e2 = validateGender(form.gender);
  if (e2) errors.gender = e2;
  // 访客用 wechat_qr（二维码截图）
  const e3 = validateWechatQr(form.wechat_qr);
  if (e3) errors.wechat_qr = e3;
  // 兼容老字段，避免后端报错
  if (!form.wechat) form.wechat = '扫码加好友';
  const e4 = validateBio(form.bio);
  if (e4) errors.bio = e4;
  const e5 = validateExpectation(form.expectation);
  if (e5) errors.expectation = e5;
  const e6 = validatePhotos(form.photos);
  if (e6) errors.photos = e6;
  return errors;
}

/**
 * 校验主人资料（7 项：6 项 + 年龄）
 */
export function validateProfileForm(form) {
  const errors = validateVisitorForm(form);
  const e = validateAge(form.age);
  if (e) errors.age = e;
  return errors;
}
