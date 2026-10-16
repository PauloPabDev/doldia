import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <header className="page-header">
        <h1>Empieza con un voto</h1>
        <p className="muted">Cada registro es un voto por la persona que quieres ser.</p>
      </header>
      <RegisterForm next={next} />
    </>
  );
}
