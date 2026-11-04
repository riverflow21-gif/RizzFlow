import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RizzFlow Admin & Store',
    short_name: 'RizzFlow Admin',
    description: 'Aplikasi Pengelola Toko Digital & Layanan Langganan RizzFlow',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#10B981',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/logo.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}