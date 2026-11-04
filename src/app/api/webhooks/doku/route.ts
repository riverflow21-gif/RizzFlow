import { NextResponse } from 'next/server';
import { getSupabaseAdmin, buildProductDeliveryItems } from '@/lib/supabase';
import { verifyDokuWebhookSignature } from '@/lib/doku';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
import { DokuWebhookPayload, Order, OrderItem } from '@/types';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const clientIdHeader = request.headers.get('Client-Id') || '';
    const requestIdHeader = request.headers.get('Request-Id') || '';
    const requestTimestampHeader = request.headers.get('Request-Timestamp') || '';
    const signatureHeader = request.headers.get('Signature') || '';

    // 1. Verifikasi Signature keamanan dari DOKU
    const isValidSignature = verifyDokuWebhookSignature({
      clientIdHeader,
      requestIdHeader,
      requestTimestampHeader,
      signatureHeader,
      requestTarget: '/api/webhooks/doku',
      rawBody,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Signature DOKU tidak valid.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as DokuWebhookPayload;
    const invoiceNumber = payload.order?.invoice_number;
    const transactionStatus = (payload.transaction?.status || '').toUpperCase();

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Nomor invoice tidak ditemukan pada payload.' }, { status: 400 });
    }

    if (transactionStatus !== 'SUCCESS' && transactionStatus !== 'PAID') {
      return NextResponse.json({ message: `Status ${transactionStatus} diabaikan.` });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Ambil data pesanan berdasarkan nomor invoice
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (orderError || !orderData) {
      return NextResponse.json({ error: 'Data pesanan tidak ditemukan.' }, { status: 404 });
    }

    const order = orderData as Order;

    if (order.payment_status === 'PAID') {
      return NextResponse.json({ message: 'Pesanan sudah berstatus PAID sebelumnya.' });
    }

    // 3. Ubah status pesanan di database menjadi PAID
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      throw new Error(`Gagal memperbarui status pembayaran: ${updateError.message}`);
    }

    // 4. Ambil daftar produk yang dibeli pada pesanan ini
    const { data: orderItemsData } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const orderItems = (orderItemsData || []) as OrderItem[];
    const fileLinks: PurchasedFileLink[] = [];

    // 5. Kumpulkan semua file unduhan (Signed URL) dan link eksternal (Google Drive) untuk tiap produk
    for (const item of orderItems) {
      if (!item.product_id) continue;

      const { data: productData } = await supabaseAdmin
        .from('products')
        .select('file_path, title')
        .eq('id', item.product_id)
        .maybeSingle();

      if (productData?.file_path) {
        try {
          const deliveryItems = await buildProductDeliveryItems({
            productTitle: item.product_title,
            quantity: item.quantity,
            rawFilePath: productData.file_path,
          });
          fileLinks.push(...deliveryItems);
        } catch (err) {
          console.error('Gagal menyiapkan link produk:', err);
        }
      }
    }

    // 6. Kirimkan email otomatis ke pelanggan
    if (fileLinks.length > 0) {
      await sendProductDeliveryEmail({
        toEmail: order.customer_email,
        invoiceNumber: order.invoice_number,
        totalPaid: order.final_amount,
        files: fileLinks,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil diverifikasi dan email produk telah dikirim.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses webhook DOKU.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}