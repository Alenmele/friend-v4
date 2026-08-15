/**
 * Tag 状态标签
 * PRD 10.2 四色：pending/approved/rejected/revoked
 */
const STATUS_CONFIG = {
  pending: { label: '待审核', className: 'tag tag-pending' },
  approved: { label: '已通过', className: 'tag tag-approved' },
  rejected: { label: '已拒绝', className: 'tag tag-rejected' },
  revoked: { label: '已撤销', className: 'tag tag-revoked' },
  locked: { label: '已锁定', className: 'tag tag-locked' },
};

export default function Tag({ status, label, className = '' }) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return <span className={`tag ${className}`}>{label}</span>;
  }
  return (
    <span className={`${config.className} ${className}`}>
      {label || config.label}
    </span>
  );
}
