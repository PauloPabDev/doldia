import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'social';
  size?: 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'hb-button',
        `hb-button--${variant}`,
        `hb-button--${size}`,
        block && 'hb-button--block',
        loading && 'hb-button--loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <span className="hb-button__icon">{icon}</span>}
      <span className="hb-button__label">{children}</span>
    </button>
  );
}
