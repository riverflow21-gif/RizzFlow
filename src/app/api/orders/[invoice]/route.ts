import { NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  buildProductDeliveryItems,
  getOrderItemsBackup,
  sendAdminTelegramNotification,
} from '@/lib/supabase';
import { checkDokuOrderStatus } from '@/lib/doku';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
import { Order, OrderItem, Product } from '@/types';

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoice: string }> }
) {
  try {
    const { invoice } = await context.params;
    const cleanInvoice = decodeURIComponent(invoice || '').trim();

    if (!cleanInvoice) {
      return NextResponse.json(
        { error: 'Nomor invoice tidak valid.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: orderData, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('invoice_number', cleanInvoice)
      .maybeSingle();

    if (error || !orderData) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan.' },
        { status: 404 }
      );
    }

    let order = orderData as Order;

    // Jika status masih PENDING, langsung tanyakan status terbaru ke server resmi DOKU!
    if (order.payment_status === 'PENDING') {
      const dokuStatus = await checkDokuOrderStatus(order.invoice_number);

      if (dokuStatus === 'SUCCESS') {
        const paidAtIso = new Date().toISOString();

        // Update atomik (hanya jika masih PENDING agar email tidak pernah terkirim 2 kali)
        const { data: updatedRows, error: updateErr } = await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'PAID',
            paid_at: paidAtIso,
          })
          .eq('id', order.id)
          .eq('payment_status', 'PENDING')
          .select('*');

        if (!updateErr && updatedRows && updatedRows.length > 0) {
          order = {
            ...order,
            payment_status: 'PAID',
            paid_at: paidAtIso,
          };

          const dbOrderItems = (order.order_items || []) as OrderItem[];
          const backupItems = await getOrderItemsBackup(order.invoice_number);

          const effectiveItems: {
            product_id: string | null;
            product_title: string;
            quantity: number;
          }[] =
            dbOrderItems.length > 0
              ? dbOrderItems.map((i) => ({
                  product_id: i.product_id,
                  product_title: i.product_title,
                  quantity: i.quantity,
                }))
              : backupItems.map((b) => ({
                  product_id: b.product_id,
                  product_title: b.product_title,
                  quantity: b.quantity,
                }));

          const productIds = effectiveItems
            .map((i) => i.product_id)
            .filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            );

          const { data: productsData } = await supabaseAdmin
            .from('products')
            .select('*')
            .in('id', productIds);

          const productList = (productsData || []) as Product[];
          const deliveryFiles: PurchasedFileLink[] = [];

          for (const item of effectiveItems) {
            if (!item.product_id) continue;
            const product = productList.find((p) => p.id === item.product_id);
            if (!product) continue;

            try {
              const builtLinks = await buildProductDeliveryItems({
                productTitle: item.product_title || product.title,
                quantity: item.quantity,
                rawFilePath: product.file_path,
              });
              deliveryFiles.push(...builtLinks);
            } catch (linkErr) {
              console.error('Gagal membuat signed link produk:', linkErr);
            }
          }

          let emailStatusNote = '✅ Email produk berhasil dikirim ke pembeli!';
          try {
            await sendProductDeliveryEmail({
              toEmail: order.customer_email,
              invoiceNumber: order.invoice_number,
              totalPaid: order.final_amount,
              files: deliveryFiles,
            });
          } catch (mailErr) {
            const errMsg =
              mailErr instanceof Error ? mailErr.message : 'Error SMTP Gmail';
            console.error('Gagal kirim email produk:', errMsg);
            emailStatusNote = `⚠️ Email GAGAL terkirim (${errMsg}).`;
          }

          const itemsSummary = effectiveItems
            .map((i) => `• ${i.product_title} (x${i.quantity})`)
            .join('\n');

          await sendAdminTelegramNotification(
            `✅ *PEMBAYARAN PRODUK LUNAS!*\n\n` +
              `🧾 Invoice: *#${order.invoice_number}*\n` +
              `📧 Pembeli: ${order.customer_email}\n` +
              `💵 Total Lunas: *Rp${order.final_amount.toLocaleString('id-ID')}*\n\n` +
              `📦 *Produk:*\n${itemsSummary || '-'}\n\n` +
              `📨 *Status Email:* ${emailStatusNote}`
          );
        } else {
          // Ambil ulang data terbaru jika webhook baru saja memprosesnya duluan
          const { data: freshOrder } = await supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', order.id)
            .maybeSingle();
          if (freshOrder) order = freshOrder as Order;
        }
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memuat status pesanan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}