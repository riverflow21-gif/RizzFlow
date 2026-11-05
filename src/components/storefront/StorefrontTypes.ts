import { Product } from '@/types';
import {
  parseThumbnails,
  parseProductDeliverables,
  ProductDeliverables,
  ProductSaleType,
  CustomServiceConfig,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
  SubscriptionOrder,
  SubscriptionOrderStatus,
} from '@/lib/supabase';

// Re-export agar semua komponen halaman toko cukup mengimpor dari satu pintu
export {
  parseThumbnails,
  parseProductDeliverables,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
};

export type {
  ProductDeliverables,
  ProductSaleType,
  CustomServiceConfig,
  SubscriptionOrder,
  SubscriptionOrderStatus,
};

// 4 Halaman Utama pada Navigasi Toko RizzFlow
export type StorefrontTab = 'home' | 'shop' | 'track' | 'services';

// Filter Tipe Katalog Produk
export type CatalogFilterType = 'ALL' | 'INSTAN' | 'LANGGANAN';

export const CART_STORAGE_KEY = 'rizzflow_cart_v1';
export const PRODUCTS_PER_SLIDE = 6;
export const VISIBLE_CATEGORY_LIMIT = 5;

export const OLD_DEFAULT_DESC =
  'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.';

export const NEW_GENERAL_DESC =
  'Koleksi produk digital pilihan, akun premium bergaransi, serta layanan pembuatan web dan template kustom untuk produktivitas terbaikmu.';

export interface ProductCardComputedInfo {
  isSubscription: boolean;
  origPrice: number | null;
  hasDiscount: boolean;
  savePercent: number;
  coverThumb: string;
  thumbList: string[];
  deliverables: ProductDeliverables;
}

/**
 * Menghitung informasi lengkap kartu produk (Foto sampul, status langganan,
 * harga coret, dan persentase diskon) agar kode di tiap halaman tetap ringkas.
 */
export function getProductCardInfo(product: Product): ProductCardComputedInfo {
  const thumbList = parseThumbnails(product.thumbnail_url);
  const coverThumb = thumbList[0] || '/logo.jpg';
  const deliverables = parseProductDeliverables(product.file_path);
  const isSubscription = deliverables.product_type === 'LANGGANAN';
  const origPrice = deliverables.original_price ?? null;
  const hasDiscount =
    typeof origPrice === 'number' && origPrice > product.price;
  const savePercent =
    hasDiscount && origPrice
      ? Math.round(((origPrice - product.price) / origPrice) * 100)
      : 0;

  return {
    isSubscription,
    origPrice,
    hasDiscount,
    savePercent,
    coverThumb,
    thumbList,
    deliverables,
  };
}

/**
 * Format angka menjadi mata uang Rupiah yang rapi (Contoh: Rp35.000).
 */
export function formatRupiah(amount: number): string {
  return `Rp${Math.max(0, amount).toLocaleString('id-ID')}`;
}

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Bagaimana cara kerja pembelian Produk Tipe Langganan (Netflix, CapCut Pro, dll.)?',
    a: 'Saat memilih produk bertanda "Langganan", kamu langsung diberikan 2 pilihan: (1) Chat Admin langsung via WhatsApp/Telegram untuk transaksi cepat, atau (2) Ambil Kode Antrian 4 Angka tanpa bayar di awal, tunggu balasan email konfirmasi stok dari Admin (maksimal 2 jam), lalu bayar via QRIS langsung di halaman Lacak Kode.',
  },
  {
    q: 'Bagaimana cara menerima file untuk Produk Instan (E-Book, Template Excel, PPT)?',
    a: 'Untuk produk bertanda "Instan", klik tombol (+) pada produk untuk memasukkan ke keranjang, lanjutkan ke Checkout, isi email aktifmu, dan bayar via QRIS. Detik itu juga setelah pembayaran terdeteksi lunas, link unduhan otomatis dikirim ke kotak masuk emailmu.',
  },
  {
    q: 'Bagaimana jika email produk belum masuk atau ada kendala?',
    a: 'Periksa tab Promosi/Spam di Gmail kamu, atau buka menu "Layanan" di navigasi bawah lalu isi Canvas Klaim Garansi dengan mencantumkan email atau nomor invoice-mu. Notifikasi akan langsung berbunyi di perangkat Admin kami.',
  },
  {
    q: 'Bagaimana cara memesan Layanan Kustom (Pembuatan Web Sederhana / Template Excel)?',
    a: 'Buka halaman "Layanan" melalui navigasi bawah, pilih tab "Jasa Kustom" pada formulir pesan, lalu tuliskan detail website atau rumus Excel yang kamu butuhkan. Admin kami akan segera menghubungi kamu.',
  },
];