import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Order } from '@/types';

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoice: string }> }
) {
  try {
    const { invoice } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: orderData, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('invoice_number', invoice)
      .maybeSingle();

    if (error || !orderData) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const order = orderData as Order;

    // Jika status masih PENDING tetapi waktu sekarang sudah melewati batas 1 jam, ubah menjadi EXPIRED
    if (
      order.payment_status === 'PENDING' &&
      new Date() > new Date(order.qris_expires_at)
    ) {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'EXPIRED' })
        .eq('id', order.id);

      order.payment_status = 'EXPIRED';
    }

    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengecek status pesanan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}