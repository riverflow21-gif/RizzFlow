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
 * Membaca daftar URL gambar thumbnail (mendukung 1 gambar lama maupun banyak gambar baru).
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
}

/**
 * Membaca isi file_path produk (mendukung format lama 1 file maupun format baru banyak file + link Drive).
 */
export function parseProductDeliverables(rawFilePath: string): ProductDeliverables {
  if (!rawFilePath) return { files: [], links: [] };
  const trimmed = rawFilePath.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { files?: unknown; links?: unknown };
      const files = Array.isArray(parsed.files)
        ? parsed.files.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        : [];
      const links = Array.isArray(parsed.links)
        ? parsed.links.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
        : [];
      return { files, links };
    } catch {
      return { files: [trimmed], links: [] };
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { files: [], links: [trimmed] };
  }

  return { files: [trimmed], links: [] };
}

/**
 * Menghasilkan daftar tombol tautan unduhan (Signed URL untuk file + Link langsung untuk Google Drive)
 * yang siap dikirimkan ke email pembeli.
 */
export async function buildProductDeliveryItems(params: {
  productTitle: string;
  quantity: number;
  rawFilePath: string;
}): Promise<{ productTitle: string; quantity: number; signedDownloadUrl: string }[]> {
  const { files, links } = parseProductDeliverables(params.rawFilePath);
  const results: { productTitle: string; quantity: number; signedDownloadUrl: string }[] = [];
  const totalItems = files.length + links.length;

  // 1. Buat Signed URL untuk setiap file yang diunggah ke Supabase Storage
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

  // 2. Masukkan setiap Link Eksternal (Google Drive, dll.)
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