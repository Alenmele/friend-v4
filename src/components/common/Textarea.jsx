/**
 * Textarea 文本域
 * rounded-2xl，禁止 resize
 */
export default function Textarea({
  label,
  required = false,
  error,
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
      <textarea
        className={`textarea-box ${error ? 'border-danger' : ''}`}
        {...props}
      />
      {error && (
        <div className="text-danger text-xs mt-1 ml-4">{error}</div>
      )}
    </div>
  );
}
