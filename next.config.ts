import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mematikan cacheComponents bawaan Next.js 16 agar katalog & stok produk selalu real-time
  cacheComponents: false,
};

export default nextConfig;