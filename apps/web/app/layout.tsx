import { ToastProvider } from '@habitos/ui';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/service-worker';
import './globals.css';
import '@/components/app.css';

const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: { default: 'Hábitos', template: '%s · Hábitos' },
  description: 'Construye hábitos con tus amigos, un voto a la vez.',
  applicationName: 'Hábitos',
  appleWebApp: { capable: true, title: 'Hábitos', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#141412' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const theme = jar.get('hb_theme')?.value;
  const mode = jar.get('hb_mode')?.value;
  return (
    <html
      lang="es"
      className={dmSans.variable}
      data-theme={theme === 'dark' || theme === 'light' ? theme : undefined}
      data-mode={mode === 'calm' ? 'calm' : undefined}
      style={{ '--font-body': 'var(--font-dm-sans), system-ui, sans-serif' } as React.CSSProperties}
    >
      <body>
        <ToastProvider>
          {children}
          <ServiceWorker />
        </ToastProvider>
      </body>
    </html>
  );
}
