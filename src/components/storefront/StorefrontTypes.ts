import { Product } from '@/types';
import {
  parseThumbnails,
  parseProductDeliverables,
  ProductDeliverables,
  CustomServiceConfig,
  CustomProjectOrder,
  DeliveryLinkItem,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
} from '@/lib/supabase';

export {
  parseThumbnails,
  parseProductDeliverables,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
};

export type {
  ProductDeliverables,
  CustomServiceConfig,
  CustomProjectOrder,
  DeliveryLinkItem,
};

// 3 Halaman Utama Toko yang Bersih & Fokus (Tanpa Tombol Kembar)
export type StorefrontTab = 'home' | 'shop' | 'services';

// Mode Filter Cepat pada Halaman Katalog (Shop)
export type ShopFilterMode = 'ALL' | 'DISCOUNT' | 'CHEAPEST';

export const CART_STORAGE_KEY = 'rizzflow_cart_v1';
export const PRODUCTS_PER_SLIDE = 6;
export const VISIBLE_CATEGORY_LIMIT = 5;
export const LOGO_PATH = '/logo.jpg?v=2';

export const OLD_DEFAULT_DESC =
  'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.';

export const NEW_GENERAL_DESC =
  'Koleksi produk digital instan, e-book, dan template siap pakai serta layanan pembuatan web dan dokumen kustom untuk produktivitas terbaikmu.';

export interface ProductCardComputedInfo {
  origPrice: number | null;
  hasDiscount: boolean;
  savePercent: number;
  coverThumb: string;
  thumbList: string[];
  deliverables: ProductDeliverables;
}

/**
 * Menghitung informasi tampilan kartu produk (Foto sampul, harga coret,
 * dan persentase diskon).
 */
export function getProductCardInfo(product: Product): ProductCardComputedInfo {
  const thumbList = parseThumbnails(product.thumbnail_url);
  const coverThumb = thumbList[0] || LOGO_PATH;
  const deliverables = parseProductDeliverables(product.file_path);
  const origPrice = deliverables.original_price ?? null;
  const hasDiscount =
    typeof origPrice === 'number' && origPrice > product.price;
  const savePercent =
    hasDiscount && origPrice
      ? Math.round(((origPrice - product.price) / origPrice) * 100)
      : 0;

  return {
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
    q: 'Bagaimana cara menerima file produk setelah saya membayar QRIS?',
    a: 'Begitu kamu selesai memindai dan membayar kode QRIS, sistem otomatis RizzFlow langsung mendeteksi pembayaranmu dalam hitungan detik dan mengirimkan link unduhan produk ke alamat email yang kamu isi saat Checkout.',
  },
  {
    q: 'Bagaimana alur pemesanan dan pembayaran Layanan Kustom?',
    a: 'Pilih jenis layanan kustom di halaman Layanan lalu kirim detail permintaanmu. Kamu akan langsung mendapatkan Kode Pesanan (KST-XXXX) di layar dan email. Saat produk kustommu selesai dikerjakan Admin, kamu akan mendapat notifikasi email dan bisa memasukkan kode KST-XXXX tersebut di halaman Layanan untuk membayar tagihan QRIS serta mengunduh produkmu.',
  },
  {
    q: 'Apakah saya harus membuat akun atau login terlebih dahulu?',
    a: 'Tidak perlu! Di RizzFlow kamu bisa langsung berbelanja tanpa perlu daftar akun. Cukup tekan tombol (+) pada produk, klik keranjang mengapung di bawah layar, masukkan email aktifmu, dan bayar via QRIS.',
  },
  {
    q: 'Bagaimana jika email produk belum masuk ke kotak masuk utama?',
    a: 'Periksa tab Promosi atau folder Spam di aplikasi Gmail kamu. Jika masih belum ditemukan, silakan buka menu Layanan lalu pilih tab Klaim Garansi dengan mencantumkan email atau nomor invoice-mu agar Admin segera mengirimkan ulang.',
  },
];