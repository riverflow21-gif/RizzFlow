import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RizzFlow Admin & Store',
    short_name: 'RizzFlow',
    description: 'Toko Produk Digital Instan & Layanan Kustom RizzFlow',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#0F2A1D',
    theme_color: '#0F2A1D',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo-app.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}