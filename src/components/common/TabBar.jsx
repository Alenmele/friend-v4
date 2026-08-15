/**
 * TabBar 胶囊 Tab 切换条
 *
 * @param {Array} tabs - [{ key, label, badge? }]
 * @param {string} active - 当前激活 key
 * @param {function} onChange
 */
export default function TabBar({ tabs = [], active, onChange }) {
  return (
    <div className="tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.key}
          className={`tab-item ${active === tab.key ? 'active' : ''} ${
            onChange ? 'cursor-pointer' : ''
          }`}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
          {tab.badge ? (
            <span className="absolute top-0.5 right-[calc(50%-28px)] bg-danger text-white text-[10px] font-semibold rounded-full px-1.5 leading-4 min-w-[18px] text-center">
              {tab.badge > 99 ? '99+' : tab.badge}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
