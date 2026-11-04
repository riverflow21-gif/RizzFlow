import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Koneksi Supabase untuk sisi Browser/Client (Katalog Publik & Login Admin).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Koneksi Supabase khusus sisi Server menggunakan Service Role Key.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Konfigurasi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum lengkap');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Membuat tautan unduhan sementara (Signed URL) dari bucket privat 'digital-products'.
 * Berlaku selama 7 hari (604.800 detik).
 */
export async function generateProductSignedUrl(filePath: string): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const expiresInSeconds = 60 * 60 * 24 * 7; // 7 Hari

  const { data, error } = await supabaseAdmin.storage
    .from('digital-products')
    .createSignedUrl(filePath, expiresInSeconds, {
      download: true,
    });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Gagal membuat link unduhan untuk file ${filePath}: ${error?.message || 'Tidak diketahui'}`
    );
  }

  return data.signedUrl;
}

/**
 * Membaca daftar URL gambar thumbnail (mendukung 1 gambar maupun banyak gambar).
 */
export function parseThumbnails(rawThumbnailUrl: string): string[] {
  if (!rawThumbnailUrl) return [];
  const trimmed = rawThumbnailUrl.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string' && item.length > 0
        );
      }
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

export type ProductSaleType = 'INSTAN' | 'LANGGANAN';

export interface ProductDeliverables {
  files: string[];
  links: string[];
  original_price?: number | null;
  product_type?: ProductSaleType;
  subscription_duration?: string | null;
}

/**
 * Membaca isi file_path produk (mendukung multi-file, link Drive, Harga Coret, & Tipe Produk Langganan).
 */
export function parseProductDeliverables(rawFilePath: string): ProductDeliverables {
  if (!rawFilePath) {
    return {
      files: [],
      links: [],
      original_price: null,
      product_type: 'INSTAN',
      subscription_duration: null,
    };
  }
  const trimmed = rawFilePath.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        files?: unknown;
        links?: unknown;
        original_price?: unknown;
        product_type?: unknown;
        subscription_duration?: unknown;
      };
      const files = Array.isArray(parsed.files)
        ? parsed.files.filter(
            (f): f is string => typeof f === 'string' && f.trim().length > 0
          )
        : [];
      const links = Array.isArray(parsed.links)
        ? parsed.links.filter(
            (l): l is string => typeof l === 'string' && l.trim().length > 0
          )
        : [];
      const original_price =
        typeof parsed.original_price === 'number' && parsed.original_price > 0
          ? parsed.original_price
          : null;
      const product_type: ProductSaleType =
        parsed.product_type === 'LANGGANAN' ? 'LANGGANAN' : 'INSTAN';
      const subscription_duration =
        typeof parsed.subscription_duration === 'string' &&
        parsed.subscription_duration.trim().length > 0
          ? parsed.subscription_duration.trim()
          : null;

      return {
        files,
        links,
        original_price,
        product_type,
        subscription_duration,
      };
    } catch {
      return {
        files: [trimmed],
        links: [],
        original_price: null,
        product_type: 'INSTAN',
        subscription_duration: null,
      };
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      files: [],
      links: [trimmed],
      original_price: null,
      product_type: 'INSTAN',
      subscription_duration: null,
    };
  }

  return {
    files: [trimmed],
    links: [],
    original_price: null,
    product_type: 'INSTAN',
    subscription_duration: null,
  };
}

export interface DeliveryLinkItem {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

/**
 * Menghasilkan daftar tombol tautan unduhan untuk dikirimkan ke email pembeli.
 */
export async function buildProductDeliveryItems(params: {
  productTitle: string;
  quantity: number;
  rawFilePath: string;
}): Promise<DeliveryLinkItem[]> {
  const { files, links } = parseProductDeliverables(params.rawFilePath);
  const results: DeliveryLinkItem[] = [];
  const totalItems = files.length + links.length;

  for (let i = 0; i < files.length; i++) {
    const signedUrl = await generateProductSignedUrl(files[i]);
    const label =
      totalItems > 1
        ? `${params.productTitle} — File ${i + 1}`
        : params.productTitle;

    results.push({
      productTitle: label,
      quantity: params.quantity,
      signedDownloadUrl: signedUrl,
    });
  }

  for (let j = 0; j < links.length; j++) {
    const label =
      links.length > 1 || files.length > 0
        ? `${params.productTitle} — Link Akses ${j + 1}`
        : `${params.productTitle} (Link Akses Produk)`;

    results.push({
      productTitle: label,
      quantity: params.quantity,
      signedDownloadUrl: links[j],
    });
  }

  return results;
}

// ============================================================================
// PENYIMPANAN PESAN, LAYANAN KUSTOM, & ANTRIAN LANGGANAN 4 ANGKA
// ============================================================================

export interface CustomerSupportMessage {
  id: string;
  type: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
  sender_name: string;
  sender_email: string;
  sender_contact: string;
  invoice_number: string;
  message: string;
  status: 'BARU' | 'SELESAI';
  created_at: string;
}

export interface CustomServiceConfig {
  title: string;
  description: string;
  services: string[];
  admin_whatsapp?: string;
  admin_telegram?: string;
}

export const DEFAULT_CUSTOM_SERVICE_CONFIG: CustomServiceConfig = {
  title: 'Layanan Pembuatan Digital Kustom Sesuai Permintaan',
  description:
    'Butuh pembuatan web sederhana, rumus template Excel khusus, atau slide presentasi kustom? Tim RizzFlow siap mengerjakannya sesuai kebutuhanmu.',
  services: [
    'Pembuatan Website Sederhana & Landing Page',
    'Template Excel & Spreadsheet Kustom',
    'Slide Presentasi PPT & Dokumen',
    'Sistem Workspace Notion & Tools AI',
  ],
  admin_whatsapp: '',
  admin_telegram: '',
};

export type SubscriptionOrderStatus =
  | 'MENUNGGU_ADMIN'
  | 'STOK_TERSEDIA'
  | 'DIPROSES'
  | 'DIBATALKAN';

export interface SubscriptionOrder {
  id: string;
  code: string;
  product_id: string;
  product_title: string;
  product_price: number;
  product_thumbnail: string;
  customer_name: string;
  customer_email: string;
  customer_contact: string;
  status: SubscriptionOrderStatus;
  admin_note: string;
  delivered_account: string;
  qris_string: string | null;
  invoice_number: string | null;
  payment_status: 'UNPAID' | 'PENDING' | 'PAID';
  created_at: string;
  expires_wait_at: string;
  updated_at: string;
}

const MESSAGES_STORAGE_FILE = '__rizzflow_customer_messages.json';
const CUSTOM_SERVICES_STORAGE_FILE = '__rizzflow_custom_services.json';
const SUBSCRIPTIONS_STORAGE_FILE = '__rizzflow_subscription_orders.json';

export async function getStoredCustomerMessages(): Promise<CustomerSupportMessage[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from('digital-products')
    .download(MESSAGES_STORAGE_FILE);

  if (error || !data) return [];

  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as CustomerSupportMessage[]) : [];
  } catch {
    return [];
  }
}

export async function saveStoredCustomerMessages(
  messages: CustomerSupportMessage[]
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const payload = JSON.stringify(messages, null, 2);

  await supabaseAdmin.storage
    .from('digital-products')
    .upload(MESSAGES_STORAGE_FILE, Buffer.from(payload, 'utf-8'), {
      contentType: 'application/json',
      upsert: true,
    });
}

export async function getStoredCustomServiceConfig(): Promise<CustomServiceConfig> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('digital-products')
      .download(CUSTOM_SERVICES_STORAGE_FILE);

    if (error || !data) {
      return DEFAULT_CUSTOM_SERVICE_CONFIG;
    }

    const text = await data.text();
    const parsed = JSON.parse(text) as Partial<CustomServiceConfig>;
    return {
      title: parsed.title || DEFAULT_CUSTOM_SERVICE_CONFIG.title,
      description:
        parsed.description || DEFAULT_CUSTOM_SERVICE_CONFIG.description,
      services:
        Array.isArray(parsed.services) && parsed.services.length > 0
          ? parsed.services
          : DEFAULT_CUSTOM_SERVICE_CONFIG.services,
      admin_whatsapp: parsed.admin_whatsapp || '',
      admin_telegram: parsed.admin_telegram || '',
    };
  } catch {
    return DEFAULT_CUSTOM_SERVICE_CONFIG;
  }
}

export async function saveStoredCustomServiceConfig(
  config: CustomServiceConfig
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const payload = JSON.stringify(config, null, 2);

  await supabaseAdmin.storage
    .from('digital-products')
    .upload(CUSTOM_SERVICES_STORAGE_FILE, Buffer.from(payload, 'utf-8'), {
      contentType: 'application/json',
      upsert: true,
    });
}

export async function getStoredSubscriptionOrders(): Promise<SubscriptionOrder[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('digital-products')
      .download(SUBSCRIPTIONS_STORAGE_FILE);

    if (error || !data) return [];

    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as SubscriptionOrder[]) : [];
  } catch {
    return [];
  }
}

export async function saveStoredSubscriptionOrders(
  orders: SubscriptionOrder[]
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const payload = JSON.stringify(orders, null, 2);

  await supabaseAdmin.storage
    .from('digital-products')
    .upload(SUBSCRIPTIONS_STORAGE_FILE, Buffer.from(payload, 'utf-8'), {
      contentType: 'application/json',
      upsert: true,
    });
}