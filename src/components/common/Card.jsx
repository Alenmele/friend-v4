/**
 * Card 卡片容器
 */
export default function Card({
  children,
  variant = 'default', // default | brand | muted
  className = '',
  ...props
}) {
  const variantClass = {
    default: 'card',
    brand: 'card card-brand',
    muted: 'card bg-surface-muted',
  }[variant];

  return (
    <div className={`${variantClass} ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * 卡片标签
 */
export function CardLabel({ children, className = '' }) {
  return (
    <div className={`text-xs font-medium text-text-secondary mb-1.5 tracking-wide ${className}`}>
      {children}
    </div>
  );
}

/**
 * 卡片内容
 */
export function CardValue({ children, className = '' }) {
  return (
    <div className={`text-sm text-text ${className}`}>
      {children}
    </div>
  );
}
