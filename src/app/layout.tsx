import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'RizzFlow — Toko Produk Digital Otomatis',
  description: 'Temukan template Excel, PPT, dan aset desain siap pakai.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${plusJakarta.className} antialiased bg-white text-[#0F172A]`}>
        {children}
      </body>
    </html>
  );
}