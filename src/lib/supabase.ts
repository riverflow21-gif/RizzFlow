import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Konfigurasi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum lengkap'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function generateProductSignedUrl(
  filePath: string
): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const expiresInSeconds = 60 * 60 * 24 * 7; // Berlaku 7 Hari

  const { data, error } = await supabaseAdmin.storage
    .from('digital-products')
    .createSignedUrl(filePath, expiresInSeconds, {
      download: true,
    });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Gagal membuat link unduhan untuk file ${filePath}: ${
        error?.message || 'Tidak diketahui'
      }`
    );
  }

  return data.signedUrl;
}

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

export interface ProductDeliverables {
  files: string[];
  links: string[];
  original_price?: number | null;
}

export function parseProductDeliverables(
  rawFilePath: string
): ProductDeliverables {
  if (!rawFilePath) {
    return { files: [], links: [], original_price: null };
  }
  const trimmed = rawFilePath.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        files?: unknown;
        links?: unknown;
        original_price?: unknown;
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

      return { files, links, original_price };
    } catch {
      return { files: [trimmed], links: [], original_price: null };
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { files: [], links: [trimmed], original_price: null };
  }

  return { files: [trimmed], links: [], original_price: null };
}

export interface DeliveryLinkItem {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

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
// PENYIMPANAN PESAN, LAYANAN KUSTOM, & NOTIFIKASI TELEGRAM (ADMIN & KLIEN)
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
  telegram_bot_token?: string;
  telegram_chat_id?: string;
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
  telegram_bot_token: '',
  telegram_chat_id: '',
};

export type CustomNotificationChannel = 'EMAIL' | 'TELEGRAM' | 'BOTH';

export type CustomOrderStatus =
  | 'MENUNGGU_PENGERJAAN'
  | 'DIPROSES'
  | 'SIAP_DIBAYAR'
  | 'LUNAS'
  | 'DIBATALKAN';

export interface CustomProjectOrder {
  id: string;
  order_code: string; // Contoh: KST-4829
  customer_name: string;
  customer_email: string;
  customer_contact: string;
  customer_telegram_id?: string;
  notify_channel?: CustomNotificationChannel;
  project_title: string;
  request_details: string;
  estimated_completion?: string; // Estimasi pengerjaan sampai selesai
  price: number;
  admin_note: string;
  file_paths: string[];
  delivery_links: string[];
  status: CustomOrderStatus;
  payment_status: 'UNPAID' | 'PENDING' | 'PAID';
  qris_string: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

const MESSAGES_STORAGE_FILE = '__rizzflow_customer_messages.json';
const CUSTOM_SERVICES_STORAGE_FILE = '__rizzflow_custom_services.json';
const CUSTOM_ORDERS_STORAGE_FILE = '__rizzflow_custom_project_orders.json';

export async function getStoredCustomerMessages(): Promise<
  CustomerSupportMessage[]
> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('digital-products')
      .download(MESSAGES_STORAGE_FILE);

    if (error || !data) return [];
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

    if (error || !data) return DEFAULT_CUSTOM_SERVICE_CONFIG;

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
      telegram_bot_token: parsed.telegram_bot_token || '',
      telegram_chat_id: parsed.telegram_chat_id || '',
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

export async function getStoredCustomProjectOrders(): Promise<
  CustomProjectOrder[]
> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('digital-products')
      .download(CUSTOM_ORDERS_STORAGE_FILE);

    if (error || !data) return [];
    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as CustomProjectOrder[]) : [];
  } catch {
    return [];
  }
}

export async function saveStoredCustomProjectOrders(
  orders: CustomProjectOrder[]
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const payload = JSON.stringify(orders, null, 2);

  await supabaseAdmin.storage
    .from('digital-products')
    .upload(CUSTOM_ORDERS_STORAGE_FILE, Buffer.from(payload, 'utf-8'), {
      contentType: 'application/json',
      upsert: true,
    });
}

/**
 * Mengirimkan notifikasi aktivitas klien ke Telegram Admin.
 */
export async function sendAdminTelegramNotification(
  messageText: string
): Promise<void> {
  try {
    const cfg = await getStoredCustomServiceConfig();
    const botToken = (
      cfg.telegram_bot_token ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim();
    const chatId = (
      cfg.telegram_chat_id ||
      process.env.TELEGRAM_CHAT_ID ||
      ''
    ).trim();

    if (!botToken || !chatId) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.error('Gagal mengirim notifikasi Telegram Admin:', e);
  }
}

/**
 * Mengirimkan notifikasi update pesanan Layanan Kustom langsung ke Telegram Klien
 * melalui bot https://t.me/RizzFlow_Notif_bot
 */
export async function sendClientTelegramNotification(
  clientChatId: string,
  messageText: string
): Promise<boolean> {
  try {
    const cleanChatId = (clientChatId || '').trim();
    if (!cleanChatId) return false;

    const cfg = await getStoredCustomServiceConfig();
    const botToken = (
      cfg.telegram_bot_token ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim();

    if (!botToken) return false;

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: messageText,
          parse_mode: 'Markdown',
        }),
      }
    );

    return res.ok;
  } catch (e) {
    console.error('Gagal mengirim notifikasi Telegram Klien:', e);
    return false;
  }
}