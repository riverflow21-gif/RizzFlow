import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rizzflow.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'RizzFlow — Toko Produk Digital, E-Book, Template & Layanan Kustom',
    template: '%s | RizzFlow',
  },
  description:
    'Beli produk digital siap pakai mulai dari template Excel, e-book, aset desain, slide PPT, hingga jasa pembuatan website sederhana dan template kustom dengan pengiriman instan via QRIS.',
  keywords: [
    'RizzFlow',
    'toko produk digital',
    'template excel',
    'jual ebook digital',
    'jasa pembuatan landing page',
    'jasa template excel kustom',
    'produk digital murah',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'RizzFlow — Toko Produk Digital & Layanan Kustom Instan',
    description:
      'Solusi produk digital instan, praktis, dan bergaransi. Pembayaran mudah via QRIS.',
    url: appUrl,
    siteName: 'RizzFlow',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: '/logo.jpg',
        width: 800,
        height: 800,
        alt: 'RizzFlow Logo',
      },
    ],
  },
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'RizzFlow',
    url: appUrl,
    logo: `${appUrl}/logo.jpg`,
    description:
      'Toko produk digital otomatis dan layanan pembuatan website sederhana serta template Excel kustom.',
  };

  return (
    <html lang="id">
      <body className={`${plusJakarta.className} antialiased bg-white text-[#0F172A]`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}