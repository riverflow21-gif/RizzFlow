import { NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  sendAdminTelegramNotification,
} from '@/lib/supabase';
import { createDokuQrisPayment } from '@/lib/doku';
import { Product, PromoCode } from '@/types';

interface CheckoutRequestItem {
  product_id: string;
  quantity: number;
}

interface CheckoutRequestBody {
  customer_email?: string;
  promo_code?: string | null;
  items?: CheckoutRequestItem[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const rawEmail = (body.customer_email || '').trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];

    // Validasi email bersih yang bebas bug karakter backslash
    const atIndex = rawEmail.indexOf('@');
    const dotIndex = rawEmail.lastIndexOf('.');
    const isValidEmail =
      rawEmail.length >= 5 &&
      !rawEmail.includes(' ') &&
      atIndex > 0 &&
      dotIndex > atIndex + 1 &&
      dotIndex < rawEmail.length - 1;

    if (!isValidEmail) {
      return NextResponse.json(
        { error: 'Mohon periksa kembali penulisan alamat email kamu.' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Keranjang belanja masih kosong.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const productIds = items.map((i) => i.product_id);

    const { data: dbProducts, error: prodError } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (prodError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json(
        { error: 'Produk yang dipilih tidak ditemukan.' },
        { status: 400 }
      );
    }

    const productMap = new Map<string, Product>();
    for (const p of dbProducts as Product[]) {
      productMap.set(p.id, p);
    }

    let subtotalAmount = 0;
    const orderItemsPayload: {
      product_id: string;
      product_title: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }[] = [];

    for (const reqItem of items) {
      const prod = productMap.get(reqItem.product_id);
      if (!prod) continue;
      const qty = Math.max(1, Number(reqItem.quantity) || 1);
      const itemTotal = prod.price * qty;
      subtotalAmount += itemTotal;

      orderItemsPayload.push({
        product_id: prod.id,
        product_title: prod.title,
        quantity: qty,
        unit_price: prod.price,
        total_price: itemTotal,
      });
    }

    if (orderItemsPayload.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada produk valid untuk diproses.' },
        { status: 400 }
      );
    }

    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    if (body.promo_code && body.promo_code.trim().length > 0) {
      const cleanPromo = body.promo_code.trim().toUpperCase();
      const { data: promoData } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', cleanPromo)
        .eq('is_active', true)
        .maybeSingle();

      if (promoData) {
        const promo = promoData as PromoCode;
        const now = Date.now();
        const startsMs = new Date(promo.starts_at).getTime();
        const expiresMs = new Date(promo.expires_at).getTime();

        if (now >= startsMs && now <= expiresMs) {
          const rawDiscount = Math.round(
            (subtotalAmount * promo.discount_percent) / 100
          );
          discountAmount =
            promo.max_discount_amount > 0
              ? Math.min(rawDiscount, promo.max_discount_amount)
              : rawDiscount;
          appliedPromoCode = promo.code;
        }
      }
    }

    const finalAmount = Math.max(1000, subtotalAmount - discountAmount);
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const qrisResult = await createDokuQrisPayment({
      invoiceNumber,
      amount: finalAmount,
      customerEmail: rawEmail,
    });

    const { data: insertedOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        invoice_number: invoiceNumber,
        customer_email: rawEmail,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        promo_code: appliedPromoCode,
        payment_status: 'PENDING',
        qris_string: qrisResult.qris_string,
        qris_expires_at: qrisResult.expires_at,
      })
      .select('*')
      .single();

    if (orderError || !insertedOrder) {
      throw new Error(
        orderError?.message || 'Gagal menyimpan pesanan ke database.'
      );
    }

    const itemsWithOrderId = orderItemsPayload.map((item) => ({
      ...item,
      order_id: insertedOrder.id,
    }));

    await supabaseAdmin.from('order_items').insert(itemsWithOrderId);

    // Kirim Notifikasi Telegram ke Admin
    const productSummary = orderItemsPayload
      .map((i) => `• ${i.product_title} (x${i.quantity})`)
      .join('\n');

    await sendAdminTelegramNotification(
      `🛍️ *CHECKOUT PESANAN BARU*\n\n` +
        `🧾 Invoice: *#${invoiceNumber}*\n` +
        `📧 Email: ${rawEmail}\n` +
        `💰 Total Tagihan: *Rp${finalAmount.toLocaleString('id-ID')}*\n\n` +
        `📦 *Produk:*\n${productSummary}`
    );

    return NextResponse.json({
      order: insertedOrder,
      simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memproses checkout.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}