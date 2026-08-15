/**
 * Navbar 顶部导航
 */
export default function Navbar({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between py-1 pb-4">
      <div className="w-11">
        {onBack && (
          <button
            onClick={onBack}
            className="text-[13px] text-primary font-medium cursor-pointer px-2 py-1 rounded-lg hover:bg-primary-light transition bg-transparent border-none"
          >
            ← 返回
          </button>
        )}
      </div>
      <div className="text-[17px] font-semibold text-text">{title}</div>
      <div className="w-11 text-right">{right}</div>
    </div>
  );
}
