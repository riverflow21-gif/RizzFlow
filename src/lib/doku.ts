import crypto from 'crypto';

export interface DokuQrisResult {
  qris_string: string;
  expires_at: string;
}

const OFFICIAL_VERCEL_URL = 'https://rizzflow-theta.vercel.app';

// Cache Token B2B SNAP di memori selama 12 menit (token resmi DOKU berlaku 15 menit)
// agar auto-cek tiap 3 detik jauh lebih cepat & tidak kena rate-limit DOKU.
let cachedSnapToken: { token: string; expiresAt: number } | null = null;

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

function getPublicAppUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (
    envUrl &&
    envUrl.startsWith('https://') &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1')
  ) {
    return envUrl.replace(/\/+$/, '');
  }
  return OFFICIAL_VERCEL_URL;
}

function formatWibTimestamp(dateObj: Date): string {
  const wibMs = dateObj.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  return wibDate.toISOString().slice(0, 19) + '+07:00';
}

function normalizePrivateKeyPem(rawKey: string): string {
  const trimmed = rawKey.trim().replace(/^["']|["']$/g, '');
  return trimmed.replace(/\\n/g, '\n');
}

function hasSnapDirectQrisConfig(): boolean {
  const privateKey = (process.env.DOKU_PRIVATE_KEY || '').trim();
  const merchantId = (process.env.DOKU_QRIS_MERCHANT_ID || '').trim();
  return privateKey.length > 0 && merchantId.length > 0;
}

/**
 * Mengambil B2B Access Token dari DOKU SNAP (dengan cache 12 menit).
 */
async function getSnapB2BToken(
  baseUrl: string,
  clientId: string,
  privateKeyPem: string,
  forceRefresh = false
): Promise<string> {
  if (
    !forceRefresh &&
    cachedSnapToken &&
    Date.now() < cachedSnapToken.expiresAt
  ) {
    return cachedSnapToken.token;
  }

  const timestamp = formatWibTimestamp(new Date());
  const stringToSign = `${clientId}|${timestamp}`;

  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(stringToSign, 'utf8'), privateKeyPem)
    .toString('base64');

  const response = await fetch(`${baseUrl}/authorization/v1/access-token/b2b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CLIENT-KEY': clientId,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify({ grantType: 'client_credentials' }),
    cache: 'no-store',
  });

  const rawText = await response.text();
  let parsed: {
    accessToken?: string;
    expiresIn?: number | string;
    responseMessage?: string;
  } = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Token SNAP DOKU gagal (HTTP ${response.status})`);
  }

  if (!response.ok || !parsed.accessToken) {
    throw new Error(
      `Gagal ambil Token SNAP DOKU: ${parsed.responseMessage || rawText.slice(0, 150)}`
    );
  }

  const expiresInSec = Number(parsed.expiresIn) || 900;
  const safeTtlMs = Math.max(60, expiresInSec - 180) * 1000;
  cachedSnapToken = {
    token: parsed.accessToken,
    expiresAt: Date.now() + safeTtlMs,
  };

  return parsed.accessToken;
}

function generateSnapSymmetricSignature(params: {
  httpMethod: string;
  endpointPath: string;
  accessToken: string;
  minifiedBody: string;
  timestamp: string;
  secretKey: string;
}): string {
  const bodyHash = crypto
    .createHash('sha256')
    .update(params.minifiedBody, 'utf8')
    .digest('hex')
    .toLowerCase();

  const stringToSign = `${params.httpMethod}:${params.endpointPath}:${params.accessToken}:${bodyHash}:${params.timestamp}`;

  return crypto
    .createHmac('sha512', params.secretKey)
    .update(stringToSign, 'utf8')
    .digest('base64');
}

async function createSnapDirectQris(params: {
  baseUrl: string;
  clientId: string;
  secretKey: string;
  privateKeyPem: string;
  merchantId: string;
  invoiceNumber: string;
  amount: number;
}): Promise<DokuQrisResult> {
  const accessToken = await getSnapB2BToken(
    params.baseUrl,
    params.clientId,
    params.privateKeyPem
  );

  const endpointPath = '/snap-adapter/b2b/v1.0/qr/qr-mpm-generate';
  const now = new Date();
  const expiresDate = new Date(now.getTime() + 60 * 60 * 1000);
  const timestamp = formatWibTimestamp(now);
  const validityPeriod = formatWibTimestamp(expiresDate);
  const externalId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

  const terminalId = (process.env.DOKU_QRIS_TERMINAL_ID || 'A01').trim();
  const postalCode = (process.env.DOKU_MERCHANT_POSTAL_CODE || '15111').trim();

  const bodyObj = {
    partnerReferenceNo: params.invoiceNumber,
    amount: {
      value: Math.round(params.amount).toFixed(2),
      currency: 'IDR',
    },
    merchantId: params.merchantId,
    terminalId,
    validityPeriod,
    additionalInfo: {
      postalCode,
      feeType: '1',
    },
  };

  const minifiedBody = JSON.stringify(bodyObj);
  const signature = generateSnapSymmetricSignature({
    httpMethod: 'POST',
    endpointPath,
    accessToken,
    minifiedBody,
    timestamp,
    secretKey: params.secretKey,
  });

  const response = await fetch(`${params.baseUrl}${endpointPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PARTNER-ID': params.clientId,
      'X-EXTERNAL-ID': externalId,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      Authorization: `Bearer ${accessToken}`,
      'CHANNEL-ID': 'H2H',
    },
    body: minifiedBody,
    cache: 'no-store',
  });

  const rawText = await response.text();
  let data: {
    qrContent?: string;
    responseCode?: string;
    responseMessage?: string;
  } = {};

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Respons Direct QRIS DOKU tidak valid (HTTP ${response.status}): ${rawText.slice(0, 150)}`
    );
  }

  if (!response.ok || !data.qrContent) {
    if (response.status === 401) {
      cachedSnapToken = null;
    }
    throw new Error(
      `DOKU Direct QRIS Error (${data.responseCode || response.status}): ${
        data.responseMessage || rawText.slice(0, 150)
      }`
    );
  }

  return {
    qris_string: data.qrContent,
    expires_at: expiresDate.toISOString(),
  };
}

async function checkSnapQrisStatus(
  baseUrl: string,
  clientId: string,
  secretKey: string,
  privateKeyPem: string,
  merchantId: string,
  invoiceNumber: string
): Promise<'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'> {
  try {
    const runQuery = async (forceRefreshToken: boolean) => {
      const accessToken = await getSnapB2BToken(
        baseUrl,
        clientId,
        privateKeyPem,
        forceRefreshToken
      );

      const endpointPath = '/snap-adapter/b2b/v1.0/qr/qr-mpm-query';
      const timestamp = formatWibTimestamp(new Date());
      const externalId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

      const bodyObj = {
        originalReferenceNo: invoiceNumber,
        originalPartnerReferenceNo: invoiceNumber,
        merchantId,
        serviceCode: '47',
      };

      const minifiedBody = JSON.stringify(bodyObj);
      const signature = generateSnapSymmetricSignature({
        httpMethod: 'POST',
        endpointPath,
        accessToken,
        minifiedBody,
        timestamp,
        secretKey,
      });

      return fetch(`${baseUrl}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PARTNER-ID': clientId,
          'X-EXTERNAL-ID': externalId,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          Authorization: `Bearer ${accessToken}`,
          'CHANNEL-ID': 'H2H',
        },
        body: minifiedBody,
        cache: 'no-store',
      });
    };

    let response = await runQuery(false);
    // Jika token cache kebetulan kedaluwarsa (401), otomatis refresh token 1 kali
    if (response.status === 401) {
      cachedSnapToken = null;
      response = await runQuery(true);
    }

    if (!response.ok) return 'UNKNOWN';

    const data = (await response.json()) as {
      latestTransactionStatus?: string;
      transactionStatusDesc?: string;
    };

    const code = (data.latestTransactionStatus || '').trim();
    const desc = (data.transactionStatusDesc || '').toUpperCase();

    if (code === '00' || desc === 'SUCCESS' || desc === 'PAID') {
      return 'SUCCESS';
    }
    if (code === '03' || desc === 'PENDING' || desc === 'INITIATED') {
      return 'PENDING';
    }
    if (code === '05' || desc === 'CANCELLED' || desc === 'EXPIRED') {
      return 'EXPIRED';
    }
    if (code === '06' || desc === 'FAILED') {
      return 'FAILED';
    }
    return 'UNKNOWN';
  } catch (err) {
    console.error('Gagal query status Direct QRIS DOKU:', err);
    return 'UNKNOWN';
  }
}

function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody?: string;
  secretKey: string;
}): string {
  let componentSignature =
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${params.requestTarget}`;

  if (params.rawBody !== undefined) {
    const digest = crypto
      .createHash('sha256')
      .update(params.rawBody, 'utf8')
      .digest('base64');
    componentSignature += `\nDigest:${digest}`;
  }

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

  if (hasSnapDirectQrisConfig()) {
    const privateKeyPem = normalizePrivateKeyPem(
      process.env.DOKU_PRIVATE_KEY || ''
    );
    const merchantId = (process.env.DOKU_QRIS_MERCHANT_ID || '').trim();

    return await createSnapDirectQris({
      baseUrl,
      clientId,
      secretKey,
      privateKeyPem,
      merchantId,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
    });
  }

  const appUrl = getPublicAppUrl();
  const isProductionServer =
    baseUrl.includes('api.doku.com') && !baseUrl.includes('sandbox');

  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const requestTarget =
    (process.env.DOKU_QRIS_ENDPOINT || '').trim() || '/checkout/v1/payment';

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

  if (isProductionServer) {
    paymentConfig.payment_method_types = ['QRIS'];
  }

  const callbackWithInvoice = `${appUrl}/checkout?invoice=${encodeURIComponent(
    params.invoiceNumber
  )}`;

  const requestBodyObj: { [key: string]: unknown } = {
    order: {
      amount: Math.round(params.amount),
      invoice_number: params.invoiceNumber,
      currency: 'IDR',
      callback_url: callbackWithInvoice,
      callback_url_result: callbackWithInvoice,
      auto_redirect: true,
    },
    payment: paymentConfig,
    customer: {
      id: params.customerEmail,
      name: safeCustomerName,
      email: params.customerEmail,
    },
    additional_info: {
      override_notification_url: `${appUrl}/api/webhooks/doku`,
    },
  };

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

export async function checkDokuOrderStatus(
  invoiceNumber: string
): Promise<'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'> {
  const isSimulation = process.env.DOKU_SIMULATION_MODE === 'true';
  if (isSimulation) return 'PENDING';

  const clientId = (process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = (process.env.DOKU_SECRET_KEY || '').trim();
  if (!clientId || !secretKey) return 'UNKNOWN';

  const baseUrl = getDokuBaseUrl();

  if (hasSnapDirectQrisConfig()) {
    const privateKeyPem = normalizePrivateKeyPem(
      process.env.DOKU_PRIVATE_KEY || ''
    );
    const merchantId = (process.env.DOKU_QRIS_MERCHANT_ID || '').trim();
    const snapStatus = await checkSnapQrisStatus(
      baseUrl,
      clientId,
      secretKey,
      privateKeyPem,
      merchantId,
      invoiceNumber
    );
    if (snapStatus !== 'UNKNOWN') {
      return snapStatus;
    }
  }

  try {
    const requestTarget = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';

    const signature = generateDokuSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      secretKey,
    });

    const response = await fetch(`${baseUrl}${requestTarget}`, {
      method: 'GET',
      headers: {
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Signature: signature,
      },
      cache: 'no-store',
    });

    if (!response.ok) return 'UNKNOWN';

    const data = (await response.json()) as {
      transaction?: { status?: string };
      response?: { transaction?: { status?: string } };
    };

    const status = (
      data?.transaction?.status ||
      data?.response?.transaction?.status ||
      ''
    ).toUpperCase();

    if (status === 'SUCCESS') return 'SUCCESS';
    if (status === 'FAILED') return 'FAILED';
    if (status === 'EXPIRED') return 'EXPIRED';
    if (status === 'PENDING') return 'PENDING';
    return 'UNKNOWN';
  } catch (err) {
    console.error('Gagal mengecek status DOKU:', err);
    return 'UNKNOWN';
  }
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