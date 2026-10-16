'use client';

import type { Me } from '@habitos/contracts';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

const SessionContext = createContext<{ me: Me; setMe: (me: Me) => void } | null>(null);

/** Contexto de sesión pequeño: sin Redux, Zustand ni React Query. */
export function SessionProvider({ me: initial, children }: { me: Me; children: ReactNode }) {
  const [me, setMe] = useState(initial);
  const value = useMemo(() => ({ me, setMe }), [me]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
