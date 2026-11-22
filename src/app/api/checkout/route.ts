import { NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  sendAdminTelegramNotification,
  saveOrderItemsBackup,
  buildProductDeliveryItems,
} from '@/lib/supabase';
import { createDokuQrisPayment, calculatePromoDiscount } from '@/lib/doku';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
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
      price_at_purchase: number;
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
        price_at_purchase: prod.price,
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
          const calc = calculatePromoDiscount(
            subtotalAmount,
            promo.discount_percent,
            promo.max_discount_amount
          );
          discountAmount = calc.discountAmount;
          appliedPromoCode = promo.code;
        }
      }
    }

    const rawAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
    const isFreeOrder = rawAfterDiscount === 0;
    // Jika 100% gratis (Rp0), tidak perlu tagih Rp1.000; jika berbayar, minimal QRIS Rp1
    const finalAmount = isFreeOrder ? 0 : Math.max(1, rawAfterDiscount);

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const productSummary = orderItemsPayload
      .map((i) => `• ${i.product_title} (x${i.quantity})`)
      .join('\n');

    // =========================================================================
    // KASUS 1: PESANAN GRATIS 100% (PROMO 100% / Rp0) -> LANGSUNG PAID & KIRIM EMAIL
    // =========================================================================
    if (isFreeOrder) {
      const nowIso = new Date().toISOString();
      const { data: insertedFreeOrder, error: freeOrderErr } =
        await supabaseAdmin
          .from('orders')
          .insert({
            invoice_number: invoiceNumber,
            customer_email: rawEmail,
            subtotal_amount: subtotalAmount,
            discount_amount: discountAmount,
            final_amount: 0,
            payment_status: 'PAID',
            qris_string: null,
            qris_expires_at: nowIso,
            paid_at: nowIso,
          })
          .select('*')
          .single();

      if (freeOrderErr || !insertedFreeOrder) {
        throw new Error(
          freeOrderErr?.message || 'Gagal menyimpan pesanan gratis.'
        );
      }

      const itemsWithOrderId = orderItemsPayload.map((item) => ({
        order_id: insertedFreeOrder.id,
        product_id: item.product_id,
        product_title: item.product_title,
        quantity: item.quantity,
        price_at_purchase: item.price_at_purchase,
      }));
      await supabaseAdmin.from('order_items').insert(itemsWithOrderId);
      await saveOrderItemsBackup(invoiceNumber, orderItemsPayload);

      const deliveryFiles: PurchasedFileLink[] = [];
      for (const item of orderItemsPayload) {
        const prod = productList.find((p) => p.id === item.product_id);
        if (!prod) continue;
        try {
          const built = await buildProductDeliveryItems({
            productTitle: item.product_title,
            quantity: item.quantity,
            rawFilePath: prod.file_path,
          });
          deliveryFiles.push(...built);
        } catch (err) {
          console.error('Gagal membuat link produk gratis:', err);
        }
      }

      let emailNote = '✅ Email produk berhasil dikirim!';
      try {
        await sendProductDeliveryEmail({
          toEmail: rawEmail,
          invoiceNumber,
          totalPaid: 0,
          files: deliveryFiles,
        });
      } catch (mailErr) {
        const m = mailErr instanceof Error ? mailErr.message : 'SMTP Error';
        emailNote = `⚠️ Email gagal terkirim (${m})`;
      }

      await sendAdminTelegramNotification(
        `🎁 *PESANAN PROMO 100% (GRATIS) SELESAI!*\n\n` +
          `🧾 Invoice: *#${invoiceNumber}*\n` +
          `📧 Email: ${rawEmail}\n` +
          (appliedPromoCode ? `🎟️ Promo: ${appliedPromoCode}\n` : '') +
          `💰 Total: *Rp0 (Gratis)*\n\n` +
          `📦 *Produk:*\n${productSummary}\n\n` +
          `📨 *Status Email:* ${emailNote}`
      );

      return NextResponse.json({
        order: insertedFreeOrder,
        simulation_mode: false,
      });
    }

    // =========================================================================
    // KASUS 2: PESANAN BERBAYAR -> HUBUNGKAN KE DOKU QRIS
    // =========================================================================
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
      order_id: insertedOrder.id,
      product_id: item.product_id,
      product_title: item.product_title,
      quantity: item.quantity,
      price_at_purchase: item.price_at_purchase,
    }));

    await supabaseAdmin.from('order_items').insert(itemsWithOrderId);
    await saveOrderItemsBackup(invoiceNumber, orderItemsPayload);

    await sendAdminTelegramNotification(
      `🛍️ *CHECKOUT PESANAN BARU*\n\n` +
        `🧾 Invoice: *#${invoiceNumber}*\n` +
        `📧 Email: ${rawEmail}\n` +
        (appliedPromoCode ? `🎟️ Promo: ${appliedPromoCode}\n` : '') +
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