/**
 * 数据导出工具
 * 支持 CSV / JSON 格式
 */

/**
 * 导出 JSON 文件
 * @param {Array} data 数据数组
 * @param {string} filename 文件名
 */
export function exportJSON(data, filename = 'visitors.json') {
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, filename);
    return { success: true };
  } catch (err) {
    console.error('JSON 导出失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 导出 CSV 文件
 * @param {Array} data 数据数组
 * @param {Array} columns 列定义 [{ key, label }]
 * @param {string} filename 文件名
 */
export function exportCSV(data, columns, filename = 'visitors.csv') {
  try {
    // 表头
    const header = columns.map((c) => escapeCSVCell(c.label)).join(',');
    // 数据行
    const rows = data.map((item) =>
      columns
        .map((c) => {
          let val = item[c.key];
          if (Array.isArray(val)) val = val.join('; ');
          if (val === null || val === undefined) val = '';
          return escapeCSVCell(String(val));
        })
        .join(',')
    );
    // 拼接 + BOM（防止 Excel 中文乱码）
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, filename);
    return { success: true };
  } catch (err) {
    console.error('CSV 导出失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * CSV 单元格转义
 */
function escapeCSVCell(val) {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * 触发下载
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 释放 URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 访客记录导出列定义
 */
export const VISITOR_COLUMNS = [
  { key: 'nickname', label: '昵称' },
  { key: 'gender', label: '性别' },
  { key: 'wechat', label: '微信号' },
  { key: 'bio', label: '自我介绍' },
  { key: 'expectation', label: '交友期许' },
  { key: 'photos', label: '照片URL' },
  { key: 'status', label: '状态' },
  { key: 'allow_reapply', label: '允许重新申请' },
  { key: 'created_at', label: '提交时间' },
];
