import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSupabaseAdmin,
  buildProductDeliveryItems,
  sendAdminTelegramNotification,
  getOrderItemsBackup,
} from '@/lib/supabase';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
import { Order, OrderItem, Product } from '@/types';

interface DokuWebhookBody {
  // Format Non-SNAP (DOKU Checkout)
  order?: {
    invoice_number?: string;
    amount?: number;
  };
  transaction?: {
    status?: string;
    date?: string;
  };
  // Format SNAP (DOKU Direct API QRIS)
  originalPartnerReferenceNo?: string;
  originalReferenceNo?: string;
  latestTransactionStatus?: string;
  transactionStatusDesc?: string;
}

function checkNonSnapSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  if (!secretKey) return false;

  const digest = crypto
    .createHash('sha256')
    .update(params.rawBody, 'utf8')
    .digest('base64');

  const requestTarget = '/api/webhooks/doku';
  const componentSignature =
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${requestTarget}\n` +
    `Digest:${digest}`;

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(componentSignature, 'utf8')
    .digest('base64');

  const expectedSignature = `HMACSHA256=${hmac}`;
  return params.signatureHeader === expectedSignature;
}

function checkSnapWebhookSignature(params: {
  xSignature: string;
  xTimestamp: string;
  rawBody: string;
  authHeader: string;
}): boolean {
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  if (!secretKey || !params.xSignature || !params.xTimestamp) return false;

  const accessToken = params.authHeader.replace(/^Bearer\s+/i, '').trim();
  let minifiedBody = params.rawBody;
  try {
    minifiedBody = JSON.stringify(JSON.parse(params.rawBody));
  } catch {
    // Gunakan rawBody asli
  }

  const bodyHash = crypto
    .createHash('sha256')
    .update(minifiedBody, 'utf8')
    .digest('hex')
    .toLowerCase();

  const endpointPath = '/api/webhooks/doku';
  const stringToSign = accessToken
    ? `POST:${endpointPath}:${accessToken}:${bodyHash}:${params.xTimestamp}`
    : `POST:${endpointPath}:${bodyHash}:${params.xTimestamp}`;

  const expectedBase64 = crypto
    .createHmac('sha512', secretKey)
    .update(stringToSign, 'utf8')
    .digest('base64');

  const expectedHex = crypto
    .createHmac('sha512', secretKey)
    .update(stringToSign, 'utf8')
    .digest('hex')
    .toLowerCase();

  return (
    params.xSignature === expectedBase64 ||
    params.xSignature.toLowerCase() === expectedHex
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const configuredClientId = (process.env.DOKU_CLIENT_ID || '').trim();

    // Header Non-SNAP
    const clientId = (request.headers.get('Client-Id') || '').trim();
    const requestId = (request.headers.get('Request-Id') || '').trim();
    const requestTimestamp = (
      request.headers.get('Request-Timestamp') || ''
    ).trim();
    const signatureHeader = (request.headers.get('Signature') || '').trim();

    // Header SNAP
    const xSignature = (request.headers.get('X-SIGNATURE') || '').trim();
    const xTimestamp = (request.headers.get('X-TIMESTAMP') || '').trim();
    const xPartnerId = (request.headers.get('X-PARTNER-ID') || '').trim();
    const authHeader = (request.headers.get('Authorization') || '').trim();

    const isSnapRequest = Boolean(xSignature || xPartnerId);
    const isSimulationMode = process.env.DOKU_SIMULATION_MODE === 'true';
    const isSimulationBypass =
      isSimulationMode && signatureHeader === 'SIMULATION_BYPASS';

    if (!isSimulationBypass) {
      if (isSnapRequest) {
        if (xPartnerId && configuredClientId && xPartnerId !== configuredClientId) {
          return NextResponse.json(
            { responseCode: '4015600', responseMessage: 'Invalid Partner ID' },
            { status: 401 }
          );
        }
        const snapValid = checkSnapWebhookSignature({
          xSignature,
          xTimestamp,
          rawBody,
          authHeader,
        });
        if (!snapValid) {
          return NextResponse.json(
            { responseCode: '4015600', responseMessage: 'Unauthorized Signature' },
            { status: 401 }
          );
        }
      } else {
        if (!configuredClientId || clientId !== configuredClientId) {
          return NextResponse.json(
            { error: 'Invalid DOKU Client ID' },
            { status: 401 }
          );
        }

        const isValid = checkNonSnapSignature({
          clientId,
          requestId,
          requestTimestamp,
          rawBody,
          signatureHeader,
        });

        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid DOKU Webhook Signature' },
            { status: 401 }
          );
        }
      }
    }

    const payload = JSON.parse(rawBody) as DokuWebhookBody;
    const invoiceNumber =
      payload.order?.invoice_number ||
      payload.originalPartnerReferenceNo ||
      payload.originalReferenceNo;

    const isSuccessStatus =
      payload.transaction?.status === 'SUCCESS' ||
      payload.latestTransactionStatus === '00' ||
      (payload.transactionStatusDesc || '').toUpperCase() === 'SUCCESS';

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: 'Missing invoice_number' },
        { status: 400 }
      );
    }

    if (!isSuccessStatus) {
      return NextResponse.json(
        isSnapRequest
          ? { responseCode: '2005600', responseMessage: 'Successful' }
          : { received: true, status: payload.transaction?.status || 'IGNORED' }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (orderErr || !orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderData as Order;
    if (order.payment_status === 'PAID') {
      return NextResponse.json(
        isSnapRequest
          ? { responseCode: '2005600', responseMessage: 'Successful' }
          : { received: true, message: 'Order already processed' }
      );
    }

    const paidAtIso = new Date().toISOString();
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'PAID',
        paid_at: paidAtIso,
      })
      .eq('id', order.id)
      .eq('payment_status', 'PENDING')
      .select('*');

    if (updateError) {
      throw new Error(`Gagal memperbarui status order: ${updateError.message}`);
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        isSnapRequest
          ? { responseCode: '2005600', responseMessage: 'Successful' }
          : { received: true, message: 'Order already processed concurrently' }
      );
    }

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
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

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
      console.error('Gagal mengirim email produk:', errMsg);
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

    if (isSnapRequest) {
      return NextResponse.json({
        responseCode: '2005600',
        responseMessage: 'Successful',
      });
    }

    return NextResponse.json({
      received: true,
      invoice_number: order.invoice_number,
      status: 'PAID_AND_DELIVERED',
      email_status: emailStatusNote,
    });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json(
      { error: 'Internal Webhook Error' },
      { status: 500 }
    );
  }
}