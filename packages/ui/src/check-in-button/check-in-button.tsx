'use client';

import { useRef } from 'react';
import { cx } from '../cx';

export type CheckInState = 'pending' | 'done' | 'min' | 'skip' | 'relapse';

export interface CheckInButtonProps {
  state: CheckInState;
  /** Texto para lectores de pantalla, por ejemplo "Leer 10 páginas". */
  label: string;
  onCheckIn: () => void;
  /** Mantener presionado abre las opciones (2 min, nota). */
  onLongPress?: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'calm';
}

const LONG_PRESS_MS = 450;

/**
 * El registro, la estrella de la app: el círculo se llena desde el punto
 * del dedo, el check se dibuja y el botón rebota. Todo con CSS.
 */
export function CheckInButton({
  state,
  label,
  onCheckIn,
  onLongPress,
  disabled,
  tone = 'accent',
}: CheckInButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const done = state === 'done' || state === 'min';

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const statusText =
    state === 'done'
      ? 'hecho'
      : state === 'min'
        ? 'hecho en versión de 2 minutos'
        : state === 'skip'
          ? 'protegido con comodín'
          : 'pendiente';

  return (
    <button
      ref={ref}
      type="button"
      className={cx('hb-checkin', `hb-checkin--${state}`, `hb-checkin--${tone}`)}
      aria-pressed={done}
      aria-label={`${label}, ${statusText}${done ? '' : ', botón registrar'}`}
      disabled={disabled}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
        longPressed.current = false;
        if (onLongPress) {
          timer.current = setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(10);
            onLongPress();
          }, LONG_PRESS_MS);
        }
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      onClick={(e) => {
        if (longPressed.current) {
          e.preventDefault();
          return;
        }
        if (e.detail === 0) {
          // Teclado: el relleno nace del centro.
          e.currentTarget.style.setProperty('--x', '50%');
          e.currentTarget.style.setProperty('--y', '50%');
        }
        navigator.vibrate?.(8);
        onCheckIn();
      }}
    >
      <span className="hb-checkin__fill" aria-hidden="true" />
      <svg className="hb-checkin__icon" viewBox="0 0 24 24" aria-hidden="true">
        {state === 'skip' ? (
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
        ) : (
          <path className="hb-checkin__check" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
        )}
      </svg>
      {state === 'min' && <span className="hb-checkin__mini">2′</span>}
    </button>
  );
}
