/**
 * Input 输入框
 * 胶囊风格，背景 #f0f2f6
 */
export default function Input({
  label,
  required = false,
  error,
  icon,
  ...props
}) {
  return (
    <div className="field mb-4">
      {label && (
        <div className="field-label text-sm font-medium text-text mb-1.5">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </div>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light">
            {icon}
          </span>
        )}
        <input
          className={`input-box ${icon ? 'pl-10' : ''} ${
            error ? 'border-danger' : ''
          }`}
          {...props}
        />
      </div>
      {error && (
        <div className="text-danger text-xs mt-1 ml-4">{error}</div>
      )}
    </div>
  );
}
