import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSupabaseAdmin,
  buildProductDeliveryItems,
  sendAdminTelegramNotification,
  getOrderItemsBackup,
} from '@/lib/supabase';
import { checkDokuOrderStatus } from '@/lib/doku';
import { sendProductDeliveryEmail, PurchasedFileLink } from '@/lib/email';
import { Order, OrderItem, Product } from '@/types';

interface ParsedWebhookInfo {
  invoiceNumber: string;
  isSuccessPayload: boolean;
  format: 'SNAP_JSON' | 'CHECKOUT_JSON' | 'LEGACY_QRIS_NOTIFY';
}

function checkNonSnapSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  if (!secretKey || !params.signatureHeader) return false;

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

  return params.signatureHeader === `HMACSHA256=${hmac}`;
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

/**
 * Mengekstrak nomor invoice dan status dari 3 kemungkinan format notifikasi DOKU:
 * 1. JSON Checkout Non-SNAP
 * 2. JSON Direct API SNAP QRIS
 * 3. Form-Encoded / URL Query Params (Notify QRIS DOKU)
 */
function parseIncomingDokuWebhook(
  requestUrl: string,
  rawBody: string,
  hasSnapHeaders: boolean
): ParsedWebhookInfo | null {
  const trimmed = rawBody.trim();

  // 1. Coba baca sebagai JSON (Checkout atau SNAP)
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as {
        order?: { invoice_number?: string };
        transaction?: { status?: string };
        originalPartnerReferenceNo?: string;
        originalReferenceNo?: string;
        latestTransactionStatus?: string;
        transactionStatusDesc?: string;
        TRANSACTIONID?: string;
        INVOICE?: string;
        TXNSTATUS?: string;
      };

      const isSnapShape = Boolean(
        hasSnapHeaders ||
          json.originalPartnerReferenceNo ||
          json.latestTransactionStatus
      );

      const invoiceNumber = (
        json.order?.invoice_number ||
        json.originalPartnerReferenceNo ||
        json.originalReferenceNo ||
        json.TRANSACTIONID ||
        json.INVOICE ||
        ''
      ).trim();

      const statusUpper = (
        json.transaction?.status ||
        json.transactionStatusDesc ||
        json.TXNSTATUS ||
        ''
      ).toUpperCase();

      const isSuccessPayload =
        statusUpper === 'SUCCESS' ||
        statusUpper === 'PAID' ||
        statusUpper === 'S' ||
        json.latestTransactionStatus === '00';

      if (invoiceNumber) {
        return {
          invoiceNumber,
          isSuccessPayload,
          format: isSnapShape ? 'SNAP_JSON' : 'CHECKOUT_JSON',
        };
      }
    } catch {
      // Lanjutkan ke pengecekan form/query di bawah
    }
  }

  // 2. Coba baca sebagai Form-Encoded Body atau URL Query Params (Legacy Direct QRIS Notify)
  const urlObj = new URL(requestUrl);
  const queryParams = urlObj.searchParams;
  const formParams = new URLSearchParams(trimmed);

  const pickParam = (key: string): string =>
    (formParams.get(key) || queryParams.get(key) || '').trim();

  const invoiceNumber =
    pickParam('TRANSACTIONID') ||
    pickParam('INVOICE') ||
    pickParam('originalPartnerReferenceNo') ||
    pickParam('invoice_number');

  const txnStatus = (
    pickParam('TXNSTATUS') ||
    pickParam('status') ||
    ''
  ).toUpperCase();

  if (invoiceNumber) {
    return {
      invoiceNumber,
      isSuccessPayload:
        txnStatus === 'S' || txnStatus === 'SUCCESS' || txnStatus === 'PAID',
      format: 'LEGACY_QRIS_NOTIFY',
    };
  }

  return null;
}

function buildSuccessAckResponse(
  format: ParsedWebhookInfo['format'],
  invoiceNumber: string,
  extraMessage?: string
) {
  if (format === 'LEGACY_QRIS_NOTIFY') {
    return new NextResponse('CONTINUE', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  if (format === 'SNAP_JSON') {
    return NextResponse.json({
      responseCode: '2005600',
      responseMessage: 'Successful',
    });
  }
  return NextResponse.json({
    received: true,
    invoice_number: invoiceNumber,
    status: extraMessage || 'PAID_AND_DELIVERED',
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const configuredClientId = (process.env.DOKU_CLIENT_ID || '').trim();

    const clientId = (request.headers.get('Client-Id') || '').trim();
    const requestId = (request.headers.get('Request-Id') || '').trim();
    const requestTimestamp = (
      request.headers.get('Request-Timestamp') || ''
    ).trim();
    const signatureHeader = (request.headers.get('Signature') || '').trim();

    const xSignature = (request.headers.get('X-SIGNATURE') || '').trim();
    const xTimestamp = (request.headers.get('X-TIMESTAMP') || '').trim();
    const xPartnerId = (request.headers.get('X-PARTNER-ID') || '').trim();
    const authHeader = (request.headers.get('Authorization') || '').trim();

    const hasSnapHeaders = Boolean(xSignature || xPartnerId);
    const parsed = parseIncomingDokuWebhook(
      request.url,
      rawBody,
      hasSnapHeaders
    );

    if (!parsed || !parsed.invoiceNumber) {
      return NextResponse.json(
        { error: 'Missing invoice_number in DOKU notification' },
        { status: 400 }
      );
    }

    const { invoiceNumber, isSuccessPayload, format } = parsed;

    const isSimulationMode = process.env.DOKU_SIMULATION_MODE === 'true';
    const isSimulationBypass =
      isSimulationMode && signatureHeader === 'SIMULATION_BYPASS';

    let isVerifiedPayment = false;

    if (isSimulationBypass) {
      isVerifiedPayment = isSuccessPayload;
    } else {
      // Tahap 1: Cek Signature Kriptografi (Non-SNAP atau SNAP)
      const nonSnapValid =
        Boolean(configuredClientId) &&
        clientId === configuredClientId &&
        checkNonSnapSignature({
          clientId,
          requestId,
          requestTimestamp,
          rawBody,
          signatureHeader,
        });

      const snapValid =
        hasSnapHeaders &&
        (!xPartnerId || !configuredClientId || xPartnerId === configuredClientId) &&
        checkSnapWebhookSignature({
          xSignature,
          xTimestamp,
          rawBody,
          authHeader,
        });

      if ((nonSnapValid || snapValid) && isSuccessPayload) {
        isVerifiedPayment = true;
      } else {
        // Tahap 2 (Keamanan Anti-Gagal): Jika formatnya Legacy QRIS Notify atau header berbeda,
        // tanyakan langsung ke server resmi DOKU (Server-to-Server) agar 100% asli & aman!
        const liveStatusFromDoku = await checkDokuOrderStatus(invoiceNumber);
        if (liveStatusFromDoku === 'SUCCESS') {
          isVerifiedPayment = true;
        } else if (!isSuccessPayload) {
          return buildSuccessAckResponse(format, invoiceNumber, 'IGNORED');
        } else {
          return NextResponse.json(
            { error: 'Unauthorized or payment not confirmed by DOKU' },
            { status: 401 }
          );
        }
      }
    }

    if (!isVerifiedPayment) {
      return buildSuccessAckResponse(format, invoiceNumber, 'IGNORED');
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
      return buildSuccessAckResponse(format, invoiceNumber, 'ALREADY_PAID');
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
      return buildSuccessAckResponse(format, invoiceNumber, 'ALREADY_PAID');
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
      `✅ *PEMBAYARAN PRODUK LUNAS OTOMATIS!*\n\n` +
        `🧾 Invoice: *#${order.invoice_number}*\n` +
        `📧 Pembeli: ${order.customer_email}\n` +
        `💵 Total Lunas: *Rp${order.final_amount.toLocaleString('id-ID')}*\n\n` +
        `📦 *Produk:*\n${itemsSummary || '-'}\n\n` +
        `📨 *Status Email:* ${emailStatusNote}`
    );

    return buildSuccessAckResponse(format, invoiceNumber, 'PAID_AND_DELIVERED');
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json(
      { error: 'Internal Webhook Error' },
      { status: 500 }
    );
  }
}