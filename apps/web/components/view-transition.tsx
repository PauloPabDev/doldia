'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

let resolveNavigation: (() => void) | null = null;

/** Resuelve la transición pendiente cuando la nueva ruta ya se pintó. */
export function ViewTransitionResolver() {
  const _pathname = usePathname();
  useEffect(() => {
    resolveNavigation?.();
    resolveNavigation = null;
  }, []);
  return null;
}

/** Navega con View Transitions nativas: la tarjeta se "expande" hasta su detalle. */
export function useTransitionNavigate() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      const doc = document as Document & {
        startViewTransition?: (cb: () => Promise<void>) => unknown;
      };
      if (
        !doc.startViewTransition ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        router.push(href);
        return;
      }
      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            resolveNavigation = resolve;
            router.push(href);
            setTimeout(resolve, 1500);
          }),
      );
    },
    [router],
  );
}
