import Button from './Button.jsx';

/**
 * Pagination 分页
 * PRD：每页 10 条
 */
export default function Pagination({
  page,
  totalPages,
  onChange,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4 mb-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← 上一页
      </Button>
      <span className="text-xs text-text-secondary px-2">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页 →
      </Button>
    </div>
  );
}
