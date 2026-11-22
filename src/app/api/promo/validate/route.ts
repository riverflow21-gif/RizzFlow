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
    const cleanCode = (body.code || '').trim().toUpperCase();
    const subtotal = Math.max(0, Number(body.subtotal) || 0);

    if (!cleanCode) {
      return NextResponse.json({
        valid: false,
        discount_percent: 0,
        discount_amount: 0,
        final_amount: subtotal,
        message: 'Masukkan kode promo terlebih dahulu.',
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', cleanCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({
        valid: false,
        discount_percent: 0,
        discount_amount: 0,
        final_amount: subtotal,
        message: `Kode promo "${cleanCode}" tidak ditemukan atau sudah tidak aktif.`,
      });
    }

    const promo = data as PromoCode;
    const now = Date.now();
    const startsMs = new Date(promo.starts_at).getTime();
    const expiresMs = new Date(promo.expires_at).getTime();

    if (now < startsMs) {
      return NextResponse.json({
        valid: false,
        discount_percent: 0,
        discount_amount: 0,
        final_amount: subtotal,
        message: `Kode promo "${cleanCode}" belum mulai berlaku.`,
      });
    }

    if (now > expiresMs) {
      return NextResponse.json({
        valid: false,
        discount_percent: 0,
        discount_amount: 0,
        final_amount: subtotal,
        message: `Kode promo "${cleanCode}" sudah kedaluwarsa.`,
      });
    }

    const { discountAmount, finalAmount } = calculatePromoDiscount(
      subtotal,
      promo.discount_percent,
      promo.max_discount_amount
    );

    return NextResponse.json({
      valid: true,
      discount_percent: promo.discount_percent,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      message: `Kode promo ${promo.code} berhasil diterapkan! Hemat Rp${discountAmount.toLocaleString('id-ID')}.`,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memeriksa kode promo.';
    return NextResponse.json(
      {
        valid: false,
        discount_percent: 0,
        discount_amount: 0,
        final_amount: 0,
        message: msg,
      },
      { status: 500 }
    );
  }
}