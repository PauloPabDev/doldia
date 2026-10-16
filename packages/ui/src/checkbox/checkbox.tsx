import { type InputHTMLAttributes, useId } from 'react';
import { cx } from '../cx';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function Checkbox({ label, description, id, className, ...rest }: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label className={cx('hb-checkbox', className)} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className="hb-checkbox__input" {...rest} />
      <span className="hb-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="hb-checkbox__text">
        <span className="hb-checkbox__label">{label}</span>
        {description && <span className="hb-checkbox__description">{description}</span>}
      </span>
    </label>
  );
}
