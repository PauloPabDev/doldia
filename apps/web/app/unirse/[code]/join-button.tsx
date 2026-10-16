'use client';

import { pact as pactSchema } from '@habitos/contracts';
import { Button } from '@habitos/ui';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export function JoinButton({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      <Button
        size="lg"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const p = await api(`/pacts/join/${code}`, {
              method: 'POST',
              body: {},
              schema: pactSchema,
            });
            window.location.assign(`/pactos/${p.id}?bienvenida=1`);
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        Unirme al pacto
      </Button>
      {error && (
        <p role="alert" className="small" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
