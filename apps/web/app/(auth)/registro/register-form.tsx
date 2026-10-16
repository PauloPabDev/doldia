'use client';

import { registerInput } from '@habitos/contracts';
import { Button, Input } from '@habitos/ui';
import Link from 'next/link';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';

export function RegisterForm({ next }: { next?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const parsed = registerInput.safeParse(data);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: parsed.data, skipRefresh: true });
      // Quien llega por invitación vuelve al pacto; el resto va al onboarding.
      window.location.assign(safeNext(next, '/onboarding'));
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      setBusy(false);
    }
  }

  return (
    <form className="auth__form" onSubmit={onSubmit} noValidate>
      <Input
        label="¿Cómo te llamamos?"
        name="displayName"
        autoComplete="given-name"
        required
        error={errors.displayName}
      />
      <Input
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={errors.email}
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres"
        required
        error={errors.password ?? errors.form}
      />
      <Button type="submit" size="lg" block loading={busy}>
        Crear cuenta
      </Button>
      <p className="auth__switch small">
        ¿Ya tienes cuenta?{' '}
        <Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar'}>Entra</Link>
      </p>
    </form>
  );
}
