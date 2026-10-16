import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // El build standalone necesita la raíz del monorepo para copiar los paquetes.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@habitos/ui'],
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // El service worker no se cachea: así las actualizaciones llegan enseguida.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default config;
