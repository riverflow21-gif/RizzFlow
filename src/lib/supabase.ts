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
    throw new Error(`Gagal membuat link unduhan untuk file ${filePath}: ${error?.message || 'Tidak diketahui'}`);
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
        return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
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

/**
 * Membaca isi file_path produk (mendukung multi-file, link Google Drive, dan Harga Coret).
 */
export function parseProductDeliverables(rawFilePath: string): ProductDeliverables {
  if (!rawFilePath) return { files: [], links: [], original_price: null };
  const trimmed = rawFilePath.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        files?: unknown;
        links?: unknown;
        original_price?: unknown;
      };
      const files = Array.isArray(parsed.files)
        ? parsed.files.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        : [];
      const links = Array.isArray(parsed.links)
        ? parsed.links.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
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

/**
 * Menghasilkan daftar tombol tautan unduhan untuk dikirimkan ke email pembeli.
 */
export async function buildProductDeliveryItems(params: {
  productTitle: string;
  quantity: number;
  rawFilePath: string;
}): Promise<{ productTitle: string; quantity: number; signedDownloadUrl: string }[]> {
  const { files, links } = parseProductDeliverables(params.rawFilePath);
  const results: { productTitle: string; quantity: number; signedDownloadUrl: string }[] = [];
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
// PENYIMPANAN PESAN KLAIM GARANSI & PESANAN LAYANAN KHUSUS (TANPA UBAH SQL)
// ============================================================================

export interface CustomerSupportMessage {
  id: string;
  type: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
  sender_name: string;
  sender_email: string;
  sender_contact: string; // No WA / Telegram pembeli (opsional)
  invoice_number: string;
  message: string;
  status: 'BARU' | 'SELESAI';
  created_at: string;
}

const MESSAGES_STORAGE_FILE = '__rizzflow_customer_messages.json';

export async function getStoredCustomerMessages(): Promise<CustomerSupportMessage[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from('digital-products')
    .download(MESSAGES_STORAGE_FILE);

  if (error || !data) {
    return [];
  }

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