/**
 * Button 组件
 * @param {string} variant - primary | danger | outline | default
 * @param {string} size - sm | md
 * @param {boolean} loading - 加载中
 * @param {boolean} disabled - 禁用
 */
export default function Button({
  children,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const baseClass = 'btn';
  const variantClass = {
    primary: 'btn-primary',
    danger: 'btn-danger',
    outline: 'btn-outline',
    default: '',
  }[variant];
  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          处理中...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
