import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Koneksi Supabase untuk sisi Browser/Client (Katalog Publik & Login Admin).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Koneksi Supabase khusus sisi Server menggunakan Service Role Key.
 * Digunakan untuk operasi rahasia seperti memvalidasi promo, menyimpan pesanan,
 * memproses webhook DOKU, dan membuat Signed URL dari bucket privat.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Konfigurasi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum lengkap di .env.local');
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
 * Tautan ini berlaku selama 7 hari (604.800 detik) sejak pembayaran selesai.
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