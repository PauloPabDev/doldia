'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cx } from '../cx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Panel inferior sobre <dialog> nativo: foco atrapado, Escape y fondo
 * inerte gratis. Se cierra deslizando hacia abajo o tocando fuera.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    ref.current.style.translate = `0 ${drag.current.dy}px`;
  };
  const onPointerUp = () => {
    if (!ref.current || !drag.current) return;
    const shouldClose = drag.current.dy > 96;
    ref.current.style.translate = '';
    drag.current = null;
    if (shouldClose) onClose();
  };

  return (
    // Tocar el fondo cierra; con teclado se cierra con Escape (onCancel).
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape ya cubre el teclado
    <dialog
      ref={ref}
      className={cx('hb-sheet', className)}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hb-sheet__panel">
        <div
          className="hb-sheet__handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        >
          <span />
        </div>
        <header className="hb-sheet__header">
          <h2 className="hb-sheet__title">{title}</h2>
          <button type="button" className="hb-sheet__close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="hb-sheet__body">{open && children}</div>
      </div>
    </dialog>
  );
}
