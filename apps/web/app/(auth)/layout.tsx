import Image from 'next/image';
import type { ReactNode } from 'react';
import './auth.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth__brand" aria-hidden="true">
        <Image src="/icons/icon.svg" alt="" width={56} height={56} priority />
      </div>
      {children}
    </main>
  );
}
