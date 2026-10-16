import {
  type InputHTMLAttributes,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { cx } from '../cx';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
  ref?: Ref<HTMLInputElement>;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cx('hb-field', error && 'hb-field--error')}>
      <label className="hb-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="hb-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="hb-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string | null) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        className={cx('hb-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        {...rest}
      />
    </Field>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export function Textarea({ label, hint, error, id, className, ...rest }: TextareaProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <textarea
        id={inputId}
        className={cx('hb-input', 'hb-input--multiline', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        {...rest}
      />
    </Field>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}

export function Select({ label, hint, error, id, className, children, ...rest }: SelectProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <select
        id={inputId}
        className={cx('hb-input', 'hb-input--select', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}
