import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { calculatePromoDiscount } from '@/lib/doku';
import { PromoCode } from '@/types';

interface ValidatePromoRequest {
  code?: string;
  subtotal?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidatePromoRequest;
    const rawCode = (body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal || 0);

    if (!rawCode) {
      return NextResponse.json(
        { valid: false, message: 'Silakan masukkan kode promo terlebih dahulu.', discount_amount: 0, promo_code: null },
        { status: 400 }
      );
    }

    if (subtotal <= 0) {
      return NextResponse.json(
        { valid: false, message: 'Keranjang belanja masih kosong.', discount_amount: 0, promo_code: null },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Cari kode promo di database berdasarkan kode unik (huruf besar)
    const { data: promoData, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', rawCode)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { valid: false, message: 'Gagal memeriksa kode promo.', discount_amount: 0, promo_code: null },
        { status: 500 }
      );
    }

    // Hitung potongan harga menggunakan fungsi standar di src/lib/doku.ts
    const result = calculatePromoDiscount(subtotal, promoData as PromoCode | null);

    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server.';
    return NextResponse.json(
      { valid: false, message, discount_amount: 0, promo_code: null },
      { status: 500 }
    );
  }
}