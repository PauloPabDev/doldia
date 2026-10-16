'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cx } from '../cx';

export interface ToastOptions {
  message: string;
  tone?: 'default' | 'celebrate' | 'social' | 'danger';
  /** Texto corto que sube y se desvanece, por ejemplo "+10 XP". */
  accent?: string;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

const DEDUPE_MS = 5000;

const ToastContext = createContext<{ show: (t: ToastOptions) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const recent = useRef(new Map<string, number>());

  const show = useCallback(
    (t: ToastOptions) => {
      // Un mismo aviso puede llegar por la respuesta de la API y por SSE: se muestra una vez.
      const now = Date.now();
      for (const [msg, at] of recent.current) if (now - at > DEDUPE_MS) recent.current.delete(msg);
      if (recent.current.has(t.message)) return;
      recent.current.set(t.message, now);
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.durationMs ?? 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="hb-toaster" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('hb-toast', t.tone && `hb-toast--${t.tone}`)}>
            <span className="hb-toast__message">{t.message}</span>
            {t.accent && <span className="hb-toast__accent">{t.accent}</span>}
            {t.action && (
              <button
                type="button"
                className="hb-toast__action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
