/**
 * 访客统计卡片
 */
export default function VisitorStats({ stats = {} }) {
  const { total = 0, pending = 0, approved = 0, rejected = 0, revoked = 0 } = stats;

  return (
    <div className="card bg-primary-light border-primary">
      <div className="flex justify-around text-center">
        <div>
          <div className="text-xl font-bold text-primary">{total}</div>
          <div className="text-xs text-text-secondary">总访客</div>
        </div>
        <div>
          <div className="text-xl font-bold text-warning">{pending}</div>
          <div className="text-xs text-text-secondary">待审核</div>
        </div>
        <div>
          <div className="text-xl font-bold text-success">{approved}</div>
          <div className="text-xs text-text-secondary">已通过</div>
        </div>
        <div>
          <div className="text-xl font-bold text-danger">{rejected}</div>
          <div className="text-xs text-text-secondary">已拒绝</div>
        </div>
      </div>
    </div>
  );
}
