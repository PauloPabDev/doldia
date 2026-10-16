'use client';

import { useState } from 'react';
import { cx } from '../cx';

export interface NudgeButtonProps {
  name: string;
  messages: Record<string, string>;
  onNudge: (key: string) => Promise<void> | void;
  sent?: boolean;
}

/** Empujón con frases amables ya escritas; nadie puede escribir algo hiriente. */
export function NudgeButton({ name, messages, onNudge, sent }: NudgeButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(sent ?? false);

  if (done) {
    return (
      <span className="hb-nudge hb-nudge--sent" role="status">
        Empujón enviado 💌
      </span>
    );
  }

  return (
    <div className="hb-nudge">
      <button
        type="button"
        className={cx('hb-nudge__trigger', open && 'hb-nudge__trigger--open')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Animar a {name}
      </button>
      {open && (
        <ul className="hb-nudge__menu" aria-label={`Mensajes para ${name}`}>
          {Object.entries(messages).map(([key, text]) => (
            <li key={key}>
              <button
                type="button"
                className="hb-nudge__option"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onNudge(key);
                    setDone(true);
                  } finally {
                    setBusy(false);
                    setOpen(false);
                  }
                }}
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
