import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { calculatePromoDiscount, createDokuQrisPayment } from '@/lib/doku';
import { Product, PromoCode } from '@/types';

interface CheckoutItemInput {
  product_id: string;
  quantity: number;
}

interface CheckoutRequestBody {
  email?: string;
  promo_code?: string | null;
  items?: CheckoutItemInput[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const customerEmail = (body.email || '').trim().toLowerCase();
    const promoCodeInput = body.promo_code ? body.promo_code.trim().toUpperCase() : null;
    const items = body.items || [];

    // 1. Validasi syarat wajib alamat email pelanggan
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: 'Alamat email wajib diisi dengan format yang benar untuk pengiriman file produk.' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Keranjang belanja kamu masih kosong.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Ambil data produk asli dari database agar harga tidak bisa dimanipulasi dari browser
    const productIds = items.map((item) => item.product_id);
    const { data: dbProducts, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (productsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json(
        { error: 'Produk yang dipilih tidak ditemukan atau sedang tidak aktif.' },
        { status: 400 }
      );
    }

    const typedProducts = dbProducts as Product[];

    // 3. Hitung subtotal berdasarkan harga resmi di database
    let subtotalAmount = 0;
    const verifiedOrderItems: {
      product_id: string;
      product_title: string;
      unit_price: number;
      quantity: number;
    }[] = [];

    for (const reqItem of items) {
      const foundProduct = typedProducts.find((p) => p.id === reqItem.product_id);
      const qty = Math.max(1, Math.floor(Number(reqItem.quantity) || 1));

      if (foundProduct) {
        subtotalAmount += foundProduct.price * qty;
        verifiedOrderItems.push({
          product_id: foundProduct.id,
          product_title: foundProduct.title,
          unit_price: foundProduct.price,
          quantity: qty,
        });
      }
    }

    if (verifiedOrderItems.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada produk valid untuk diproses.' },
        { status: 400 }
      );
    }

    // 4. Validasi ulang kode promo di sisi server jika pelanggan memasukkan kode promo
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    if (promoCodeInput) {
      const { data: promoData } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', promoCodeInput)
        .maybeSingle();

      const promoResult = calculatePromoDiscount(subtotalAmount, promoData as PromoCode | null);
      if (promoResult.valid) {
        discountAmount = promoResult.discount_amount;
        appliedPromoCode = promoResult.promo_code;
      }
    }

    const finalAmount = Math.max(0, subtotalAmount - discountAmount);

    // 5. Buat nomor invoice unik (Contoh: INV-20261103-8492)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${datePart}-${randomPart}`;

    // 6. Panggil DOKU API untuk membuat QRIS dengan batas kedaluwarsa 1 jam (60 menit)
    const dokuQris = await createDokuQrisPayment({
      invoiceNumber,
      amount: finalAmount,
      customerEmail,
    });

    // 7. Simpan pesanan ke tabel orders di database Supabase
    const { data: insertedOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        invoice_number: invoiceNumber,
        customer_email: customerEmail,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        promo_code_used: appliedPromoCode,
        payment_status: 'PENDING',
        qris_string: dokuQris.qris_string,
        qris_expires_at: dokuQris.expires_at,
      })
      .select('*')
      .single();

    if (orderError || !insertedOrder) {
      throw new Error(`Gagal menyimpan pesanan: ${orderError?.message || 'Tidak diketahui'}`);
    }

    // 8. Simpan rincian item yang dibeli ke tabel order_items
    const orderItemsPayload = verifiedOrderItems.map((item) => ({
      order_id: insertedOrder.id,
      product_id: item.product_id,
      product_title: item.product_title,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      throw new Error(`Gagal menyimpan rincian produk pesanan: ${itemsError.message}`);
    }

    return NextResponse.json({
      order: insertedOrder,
      simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}