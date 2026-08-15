/**
 * RadioGroup 单选组
 * 用于性别选择
 *
 * @param {Array} options - [{ value, label }]
 * @param {string} value - 当前值
 * @param {function} onChange
 */
export default function RadioGroup({
  options = [],
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="radio-group flex gap-3">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          disabled={disabled}
          className={`radio-option flex-1 text-center py-3 rounded-full text-sm font-medium border transition ${
            value === opt.value
              ? 'bg-primary text-white border-primary'
              : 'border-border text-text-secondary bg-surface hover:border-primary'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={() => !disabled && onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
