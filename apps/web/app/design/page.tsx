import type { Metadata } from 'next';
import { Catalog } from './catalog';

export const metadata: Metadata = { title: 'Design system' };

/** Catálogo interno de componentes y estados, sin instalar Storybook. */
export default function DesignPage() {
  return <Catalog />;
}
