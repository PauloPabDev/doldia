'use client';

import { useState } from 'react';
import { cx } from '../cx';

export interface ReactionBarProps {
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
  options: readonly string[];
  onToggle: (emoji: string, mine: boolean) => void;
  disabled?: boolean;
}

/** Reacciones rápidas. El emoji "vuela" al tocarlo; con un toque largo se abre la paleta. */
export function ReactionBar({ reactions, options, onToggle, disabled }: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const [flying, setFlying] = useState<string | null>(null);

  const toggle = (emoji: string, mine: boolean) => {
    if (!mine) {
      setFlying(emoji);
      setTimeout(() => setFlying(null), 600);
    }
    onToggle(emoji, mine);
    setOpen(false);
  };

  return (
    <div className="hb-reactions">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={cx('hb-reactions__chip', r.mine && 'hb-reactions__chip--mine')}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ', quitar mi reacción' : ', reaccionar'}`}
          onClick={() => toggle(r.emoji, r.mine)}
          disabled={disabled}
        >
          <span aria-hidden="true" className={cx(flying === r.emoji && 'hb-reactions__fly')}>
            {r.emoji}
          </span>
          <span className="hb-reactions__count">{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        className="hb-reactions__add"
        aria-expanded={open}
        aria-label="Reaccionar"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01" />
        </svg>
      </button>
      {open && (
        <div className="hb-reactions__palette" role="group" aria-label="Elige una reacción">
          {options.map((emoji) => {
            const mine = reactions.some((r) => r.emoji === emoji && r.mine);
            return (
              <button
                key={emoji}
                type="button"
                className="hb-reactions__option"
                onClick={() => toggle(emoji, mine)}
                aria-label={`Reaccionar con ${emoji}`}
              >
                <span aria-hidden="true" className={cx(flying === emoji && 'hb-reactions__fly')}>
                  {emoji}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
