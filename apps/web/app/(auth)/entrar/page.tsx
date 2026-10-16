import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <header className="page-header">
        <h1>Hola de nuevo</h1>
        <p className="muted">Tu pacto te está esperando.</p>
      </header>
      <LoginForm next={next} />
    </>
  );
}
