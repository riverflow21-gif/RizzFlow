import { NextResponse } from 'next/server';
import { getSupabaseAdmin, buildProductDeliveryItems } from '@/lib/supabase';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
import { Order, OrderItem } from '@/types';

interface ResendEmailRequestBody {
  order_id?: string;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Sesi login Admin tidak valid atau sudah habis.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ResendEmailRequestBody;
    const orderId = body.order_id;

    if (!orderId) {
      return NextResponse.json({ error: 'ID Pesanan wajib diisi.' }, { status: 400 });
    }

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      return NextResponse.json({ error: 'Data pesanan tidak ditemukan.' }, { status: 404 });
    }

    const order = orderData as Order;

    const { data: orderItemsData } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const orderItems = (orderItemsData || []) as OrderItem[];
    const fileLinks: PurchasedFileLink[] = [];

    for (const item of orderItems) {
      if (!item.product_id) continue;

      const { data: productData } = await supabaseAdmin
        .from('products')
        .select('file_path, title')
        .eq('id', item.product_id)
        .maybeSingle();

      if (productData?.file_path) {
        const deliveryItems = await buildProductDeliveryItems({
          productTitle: item.product_title,
          quantity: item.quantity,
          rawFilePath: productData.file_path,
        });
        fileLinks.push(...deliveryItems);
      }
    }

    if (fileLinks.length === 0) {
      return NextResponse.json(
        { error: 'File atau link produk untuk pesanan ini tidak ditemukan.' },
        { status: 400 }
      );
    }

    await sendProductDeliveryEmail({
      toEmail: order.customer_email,
      invoiceNumber: order.invoice_number,
      totalPaid: order.final_amount,
      files: fileLinks,
    });

    return NextResponse.json({
      success: true,
      message: `Email unduhan berhasil dikirim ulang ke ${order.customer_email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengirim ulang email.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}