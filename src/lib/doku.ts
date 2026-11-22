import crypto from 'crypto';

export interface DokuQrisResult {
  qris_string: string;
  expires_at: string;
}

/**
 * Menghitung potongan diskon kode promo dan total akhir pembayaran.
 */
export function calculatePromoDiscount(
  subtotal: number,
  discountPercent: number,
  maxDiscountAmount: number
): { discountAmount: number; finalAmount: number } {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safePercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const safeMax = Math.max(0, Number(maxDiscountAmount) || 0);

  const rawDiscount = Math.round((safeSubtotal * safePercent) / 100);
  const discountAmount =
    safeMax > 0 ? Math.min(rawDiscount, safeMax) : rawDiscount;
  const finalAmount = Math.max(0, safeSubtotal - discountAmount);

  return { discountAmount, finalAmount };
}

function getDokuBaseUrl(): string {
  const customUrl = (process.env.DOKU_API_BASE_URL || '').trim();
  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }
  const isProd = process.env.DOKU_IS_PRODUCTION === 'true';
  return isProd ? 'https://api.doku.com' : 'https://api-sandbox.doku.com';
}

function getAppUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://rizzflow-theta.vercel.app';
}

function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody: string;
  secretKey: string;
}): string {
  const digest = crypto
    .createHash('sha256')
    .update(params.rawBody, 'utf8')
    .digest('base64');

  const componentSignature =
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${params.requestTarget}\n` +
    `Digest:${digest}`;

  const hmac = crypto
    .createHmac('sha256', params.secretKey)
    .update(componentSignature, 'utf8')
    .digest('base64');

  return `HMACSHA256=${hmac}`;
}

export async function createDokuQrisPayment(params: {
  invoiceNumber: string;
  amount: number;
  customerEmail: string;
}): Promise<DokuQrisResult> {
  const isSimulation = process.env.DOKU_SIMULATION_MODE === 'true';
  const clientId = (process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  const expiresAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Mode Simulasi (QR Dummy tanpa menghubungi server DOKU)
  if (isSimulation) {
    const dummyQris = `00020101021226660014ID.CO.DOKU.WWW01189360089900000000000215${params.invoiceNumber}520458125303360540${params.amount}5802ID5908RIZZFLOW6007JAKARTA6304ABCD`;
    return {
      qris_string: dummyQris,
      expires_at: expiresAtIso,
    };
  }

  if (!clientId || !secretKey) {
    throw new Error(
      'DOKU_CLIENT_ID atau DOKU_SECRET_KEY belum diatur di Environment Variables.'
    );
  }

  const baseUrl = getDokuBaseUrl();
  const appUrl = getAppUrl();
  const isProductionServer =
    baseUrl.includes('api.doku.com') && !baseUrl.includes('sandbox');

  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const requestTarget =
    (process.env.DOKU_QRIS_ENDPOINT || '').trim() || '/checkout/v1/payment';

  // DOKU mensyaratkan customer.name hanya berupa huruf (tanpa angka/simbol)
  const rawName = (params.customerEmail.split('@')[0] || 'Customer')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();
  const safeCustomerName = rawName.length > 0 ? rawName : 'Customer';

  const paymentConfig: {
    payment_due_date: number;
    payment_method_types?: string[];
  } = {
    payment_due_date: 60,
  };

  // QRIS hanya didukung di server DOKU Production (bukan Sandbox)
  if (isProductionServer) {
    paymentConfig.payment_method_types = ['QRIS'];
  }

  const isPublicHttpsUrl =
    appUrl.startsWith('https://') &&
    !appUrl.includes('localhost') &&
    !appUrl.includes('127.0.0.1');

  const requestBodyObj: Record<string, unknown> = {
    order: {
      amount: Math.round(params.amount),
      invoice_number: params.invoiceNumber,
      currency: 'IDR',
      callback_url: `${appUrl}/checkout`,
    },
    payment: paymentConfig,
    customer: {
      id: params.customerEmail,
      name: safeCustomerName,
      email: params.customerEmail,
    },
  };

  // Parameter resmi DOKU Checkout untuk mengarahkan Webhook (hanya jika URL publik HTTPS)
  if (isPublicHttpsUrl) {
    requestBodyObj.additional_info = {
      override_notification_url: `${appUrl}/api/webhooks/doku`,
    };
  }

  const rawBody = JSON.stringify(requestBodyObj);
  const signature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    secretKey,
  });

  const response = await fetch(`${baseUrl}${requestTarget}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      Signature: signature,
    },
    body: rawBody,
  });

  const rawResponseText = await response.text();
  let data: {
    message?: string[];
    error?: { message?: string };
    response?: {
      payment?: {
        qr_string?: string;
        qris_string?: string;
        url?: string;
      };
    };
    qr_string?: string;
  } = {};

  try {
    data = JSON.parse(rawResponseText);
  } catch {
    throw new Error(
      `Respons DOKU tidak valid (HTTP ${response.status}): ${rawResponseText.slice(0, 150)}`
    );
  }

  if (!response.ok) {
    const errDetail =
      data?.error?.message ||
      (Array.isArray(data?.message) ? data.message.join(', ') : '') ||
      `HTTP ${response.status}`;
    throw new Error(`DOKU Error: ${errDetail}`);
  }

  const qrisString =
    data?.response?.payment?.qr_string ||
    data?.response?.payment?.qris_string ||
    data?.qr_string ||
    data?.response?.payment?.url ||
    '';

  if (!qrisString) {
    throw new Error('Respons DOKU tidak menyertakan URL/kode pembayaran.');
  }

  return {
    qris_string: qrisString,
    expires_at: expiresAtIso,
  };
}

export function verifyDokuWebhookSignature(params: {
  requestId: string;
  requestTimestamp: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const clientId = (process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  if (!clientId || !secretKey) return false;

  const expected = generateDokuSignature({
    clientId,
    requestId: params.requestId,
    requestTimestamp: params.requestTimestamp,
    requestTarget: '/api/webhooks/doku',
    rawBody: params.rawBody,
    secretKey,
  });

  return params.signatureHeader === expected;
}