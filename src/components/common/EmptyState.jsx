/**
 * EmptyState 空状态
 */
export default function EmptyState({
  icon = '📭',
  title = '暂无数据',
  description = '',
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-5xl mb-3 opacity-60">{icon}</div>
      <div className="text-sm font-medium text-text mb-1">{title}</div>
      {description && (
        <div className="text-xs text-text-secondary mb-4">{description}</div>
      )}
      {action}
    </div>
  );
}
