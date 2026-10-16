import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hábitos con amigos',
    short_name: 'Hábitos',
    description: 'Construye hábitos con tus amigos, un voto a la vez.',
    start_url: '/hoy',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    // Colores tomados de los tokens (--color-bg y --color-accent).
    background_color: '#FBFAF7',
    theme_color: '#2F6F5E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Registrar hoy',
        short_name: 'Registrar',
        url: '/hoy?origen=atajo',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
