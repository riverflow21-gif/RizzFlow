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

/**
 * Memvalidasi email pelanggan:
 * - Wajib diisi
 * - Mendukung semua penyedia email (@gmail.com, @yahoo.com, @outlook.com, @domain.co.id, dll.)
 * - Mengecek kebenaran penulisan domain setelah tanda '@'
 */
function validateEmailFormat(rawEmail: string): {
  valid: boolean;
  message: string;
} {
  if (!rawEmail) {
    return {
      valid: false,
      message: 'Alamat email wajib diisi terlebih dahulu.',
    };
  }

  if (rawEmail.includes(' ')) {
    return {
      valid: false,
      message: 'Alamat email tidak boleh mengandung spasi.',
    };
  }

  const parts = rawEmail.split('@');
  if (parts.length !== 2) {
    return {
      valid: false,
      message: 'Alamat email harus mengandung tepat satu tanda "@".',
    };
  }

  const localPart = parts[0];
  const domainPart = parts[1];

  if (!localPart || localPart.length < 1) {
    return {
      valid: false,
      message: 'Penulisan nama email sebelum tanda "@" belum lengkap.',
    };
  }

  if (
    !domainPart ||
    !domainPart.includes('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.startsWith('-') ||
    domainPart.endsWith('-') ||
    domainPart.includes('..')
  ) {
    return {
      valid: false,
      message:
        'Penulisan domain email setelah tanda "@" belum tepat (contoh: nama@gmail.com atau nama@yahoo.com).',
    };
  }

  const domainLabels = domainPart.split('.');
  const topLevelDomain = domainLabels[domainLabels.length - 1];

  if (!topLevelDomain || topLevelDomain.length < 2) {
    return {
      valid: false,
      message:
        'Akhiran domain email setelah tanda "@" tidak valid (contoh: .com, .id, .co.id).',
    };
  }

  for (const label of domainLabels) {
    if (!label || label.length === 0) {
      return {
        valid: false,
        message: 'Penulisan domain email setelah tanda "@" belum benar.',
      };
    }
  }

  return { valid: true, message: 'OK' };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const rawEmail = (body.customer_email || '').trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];

    // 1. Validasi Email (Hanya menolak jika email kosong atau domain setelah @ salah)
    const emailCheck = validateEmailFormat(rawEmail);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.message }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Keranjang belanja kamu masih kosong.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const productIds = items
      .map((i) => i.product_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

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

    const productList = dbProducts as Product[];
    let subtotalAmount = 0;
    const orderItemsPayload: {
      product_id: string;
      product_title: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }[] = [];

    for (const reqItem of items) {
      const prod = productList.find((p) => p.id === reqItem.product_id);
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

    // 2. Kode Promo 100% Opsional (Tidak pernah menolak checkout meskipun kosong/tidak valid)
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    const optionalPromo =
      typeof body.promo_code === 'string' ? body.promo_code.trim() : '';

    if (optionalPromo.length > 0) {
      const cleanPromo = optionalPromo.toUpperCase();
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