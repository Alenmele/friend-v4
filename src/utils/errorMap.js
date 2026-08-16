/**
 * 错误信息映射工具
 * 将 Supabase/系统返回的英文错误信息转换为中文
 */

const ERROR_MAP = {
  'permission denied for table profiles': '没有权限保存资料，请联系管理员修复权限',
  'permission denied for table visitors': '没有权限访问访客数据',
  'permission denied for table notifications': '没有权限访问通知数据',
  'duplicate key': '数据重复，请检查后重试',
  'duplicate key value violates unique constraint': '数据重复，请检查后重试',
  'violates foreign key constraint': '关联数据不存在',
  'null value': '必填项不能为空',
  'check constraint': '数据格式不符合要求',
  'Email not confirmed': '邮箱未验证，请先验证邮箱',
  'Invalid login credentials': '邮箱或密码错误',
  'email rate limit exceeded': '登录尝试过于频繁，请稍后再试',
  'rate limit exceeded': '操作过于频繁，请稍后再试',
  'User already registered': '该邮箱已注册',
  'Password should be at least': '密码至少需要 6 位',
  'Invalid email': '邮箱格式不正确',
  'expired': '会话已过期，请重新登录',
  'session': '会话已失效，请重新登录',
  'network': '网络连接失败，请检查网络',
  'timeout': '请求超时，请稍后重试',
  'Failed to fetch': '网络连接失败',
  'upload': '上传失败，请检查网络或文件大小',
  'storage': '存储空间操作失败',
  'bucket': '存储桶不存在或未配置',
  'not found': '数据不存在',
  'no rows': '数据不存在',
  'more than one row': '返回了多条数据',
  'invalid': '数据格式不正确',
  'missing': '缺少必要参数',
  'context': '上下文信息缺失',
  // 新增 RPC / 自定义中文错误
  'function': '功能未找到，请联系管理员',
  'column': '数据结构错误，请联系管理员',
  '抱歉，主人暂不允许你重新申请': '抱歉，主人暂不允许你重新申请',
  '无管理员权限': '无管理员权限',
  '用户未登录': '用户未登录',
  '主人ID不能为空': '主人ID不能为空',
  '访客token不能为空': '访客token不能为空',
  '昵称不能为空': '昵称不能为空',
  '性别参数非法': '性别参数非法',
  '微信号不能为空': '微信号不能为空',
  '至少需要上传 1 张照片': '至少需要上传 1 张照片',
  '主人不存在': '主人不存在',
  '访客记录不存在': '访客记录不存在',
  '你无权审核其他主人的访客': '你无权审核其他主人的访客',
  '撤销权限仅对已通过状态有效': '撤销权限仅对已通过状态有效',
  '该邮箱已注册': '该邮箱已注册',
  '邮箱格式不正确': '邮箱格式不正确',
  '链接ID': '链接ID',
  '昵称': '昵称',
  '性别': '性别',
  '年龄': '年龄',
  '微信号': '微信号',
  '自我介绍': '自我介绍',
  '交友期许': '交友期许',
  '照片': '照片',
};

/**
 * 将错误信息转换为中文
 * @param {string} message - 原始错误信息
 * @returns {string} 中文错误信息
 */
export function translateError(message) {
  if (!message) return '操作失败，请重试';
  
  // 检查是否已经是中文
  const chineseRegex = /[\u4e00-\u9fa5]/;
  if (chineseRegex.test(message)) return message;
  
  // 遍历错误映射表
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // 根据错误类型返回通用中文提示
  if (message.includes('permission')) return '没有权限执行此操作';
  if (message.includes('network')) return '网络连接失败，请检查网络';
  if (message.includes('timeout')) return '请求超时，请稍后重试';
  if (message.includes('upload')) return '上传失败，请重试';
  if (message.includes('auth')) return '认证失败，请重新登录';
  if (message.includes('not found')) return '数据不存在';
  
  // 返回通用提示
  return '操作失败，请稍后重试';
}

/**
 * 从错误对象中提取并翻译错误信息
 * @param {Error|object} error - 错误对象
 * @returns {string} 中文错误信息
 */
export function getErrorMessage(error) {
  if (!error) return '操作失败，请重试';
  
  // 如果是 Error 对象
  if (error instanceof Error) {
    return translateError(error.message);
  }
  
  // 如果是 Supabase 错误对象
  if (typeof error === 'object') {
    // Supabase { error: 'message', message: 'message' }
    if (error.error) return translateError(error.error);
    if (error.message) return translateError(error.message);
    if (error.details) return translateError(error.details);
    if (error.msg) return translateError(error.msg);
  }
  
  // 字符串类型
  if (typeof error === 'string') {
    return translateError(error);
  }
  
  return '操作失败，请重试';
}
