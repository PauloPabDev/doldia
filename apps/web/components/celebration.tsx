'use client';

import { Button } from '@habitos/ui';
import { useEffect } from 'react';

const COLORS = [
  'var(--color-celebrate)',
  'var(--color-social)',
  'var(--color-accent)',
  'var(--color-calm)',
];

export interface CelebrationProps {
  emoji: string;
  title: string;
  body: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}

/** Celebración grande, reservada para momentos clave (primer registro, nivel, semana completa). */
export function Celebration({ emoji, title, body, onClose, action }: CelebrationProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="celebration"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <div className="celebration__card">
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  left: `${(i * 37) % 100}%`,
                  background: COLORS[i % COLORS.length],
                  animationDelay: `${(i % 7) * 60}ms`,
                  '--dx': `${((i * 53) % 80) - 40}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <span className="celebration__emoji" aria-hidden="true">
          {emoji}
        </span>
        <h2 id="celebration-title">{title}</h2>
        <p className="muted">{body}</p>
        {action && (
          <Button block size="lg" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        <Button variant={action ? 'ghost' : 'primary'} block onClick={onClose} autoFocus={!action}>
          {action ? 'Ahora no' : 'Seguir'}
        </Button>
      </div>
    </div>
  );
}
