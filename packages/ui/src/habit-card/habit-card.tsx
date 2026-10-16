'use client';

import { useRef } from 'react';
import { CheckInButton, type CheckInState } from '../check-in-button/check-in-button';
import { cx } from '../cx';
import { StreakFlame } from '../streak-flame/streak-flame';

export interface HabitCardProps {
  id: string;
  title: string;
  kind: 'build' | 'break';
  identityLabel: string;
  identityColor: string;
  state: CheckInState;
  streak: number;
  minVersion?: string | null;
  cue?: string | null;
  /** Hábitos a romper: días de libertad y lo ganado ("12 h"). */
  freedomDays?: number;
  freedomSaved?: string | null;
  /** Siguiente de la cadena: se resalta suavemente. */
  highlight?: boolean;
  onCheckIn: () => void;
  onOptions?: () => void;
  onOpen?: () => void;
  onSnooze?: () => void;
}

const SWIPE_PX = 80;

export function HabitCard(props: HabitCardProps) {
  const {
    id,
    title,
    kind,
    identityLabel,
    identityColor,
    state,
    streak,
    minVersion,
    cue,
    freedomDays,
    freedomSaved,
    highlight,
    onCheckIn,
    onOptions,
    onOpen,
    onSnooze,
  } = props;
  const ref = useRef<HTMLLIElement>(null);
  const swipe = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null);
  const done = state === 'done' || state === 'min';

  // Deslizar a la derecha registra; a la izquierda pospone. Siempre hay botón alternativo.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
    swipe.current = { x: e.clientX, y: e.clientY, dx: 0, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || !ref.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.active && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) s.active = true;
    if (!s.active) return;
    s.dx = dx;
    ref.current.style.translate = `${Math.max(-120, Math.min(120, dx))}px 0`;
  };
  const onPointerEnd = () => {
    const s = swipe.current;
    swipe.current = null;
    if (!ref.current) return;
    ref.current.style.translate = '';
    if (!s?.active) return;
    if (s.dx > SWIPE_PX && !done) onCheckIn();
    else if (s.dx < -SWIPE_PX) onSnooze?.();
  };

  return (
    <li
      ref={ref}
      className={cx(
        'hb-habit',
        done && 'hb-habit--done',
        highlight && 'hb-habit--next',
        kind === 'break' && 'hb-habit--break',
      )}
      style={
        {
          '--identity-color': identityColor,
          viewTransitionName: `habit-${id}`,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="hb-habit__main">
        <button type="button" className="hb-habit__open" onClick={onOpen}>
          <span className="hb-habit__identity">
            <span className="hb-habit__dot" aria-hidden="true" />
            {identityLabel}
          </span>
          <span className="hb-habit__title">{title}</span>
          {kind === 'build' && minVersion && !done && (
            <span className="hb-habit__meta">2 min: {minVersion}</span>
          )}
          {cue && !done && <span className="hb-habit__meta">{cue}</span>}
        </button>
        {kind === 'build' ? (
          <StreakFlame count={streak} shielded={state === 'skip'} className="hb-habit__streak" />
        ) : (
          <span className="hb-habit__freedom">
            <span className="hb-visually-hidden">{`${freedomDays ?? 0} días de libertad`}</span>
            <strong aria-hidden="true">{freedomDays ?? 0}</strong>
            <span aria-hidden="true">
              {freedomSaved ? `días · ${freedomSaved}` : 'días libres'}
            </span>
          </span>
        )}
      </div>
      <div className="hb-habit__actions">
        {onOptions && !done && (
          <button
            type="button"
            className="hb-habit__more"
            onClick={onOptions}
            aria-label={`Más opciones para ${title}`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        )}
        <CheckInButton
          state={state}
          label={title}
          onCheckIn={onCheckIn}
          onLongPress={onOptions}
          disabled={done}
          tone={kind === 'break' ? 'calm' : 'accent'}
        />
      </div>
    </li>
  );
}
