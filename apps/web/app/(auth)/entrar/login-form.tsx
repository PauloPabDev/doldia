'use client';

import { loginInput } from '@habitos/contracts';
import { Button, Input } from '@habitos/ui';
import Link from 'next/link';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginInput.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: parsed.data, skipRefresh: true });
      window.location.assign(safeNext(next));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="auth__form" onSubmit={onSubmit} noValidate>
      <Input
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={error}
      />
      <Button type="submit" size="lg" block loading={busy}>
        Entrar
      </Button>
      <p className="auth__switch small">
        ¿Primera vez?{' '}
        <Link href={next ? `/registro?next=${encodeURIComponent(next)}` : '/registro'}>
          Crea tu cuenta
        </Link>
      </p>
    </form>
  );
}
