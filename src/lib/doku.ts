import crypto from 'crypto';

export interface DokuQrisResult {
  qris_string: string;
  expires_at: string;
}

function getDokuBaseUrl(): string {
  const customUrl = (process.env.DOKU_API_BASE_URL || '').trim();
  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }
  const isProd = process.env.DOKU_IS_PRODUCTION === 'true';
  return isProd ? 'https://api.doku.com' : 'https://api-sandbox.doku.com';
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

  if (isSimulation) {
    const dummyQris = `00020101021226660014ID.CO.DOKU.WWW01189360089900000000000215${params.invoiceNumber}520458125303360540${params.amount}5802ID5908RIZZFLOW6007JAKARTA6304ABCD`;
    return {
      qris_string: dummyQris,
      expires_at: expiresAtIso,
    };
  }

  if (!clientId || !secretKey) {
    throw new Error(
      'DOKU_CLIENT_ID atau DOKU_SECRET_KEY belum diisi di Environment Variables Vercel.'
    );
  }

  const baseUrl = getDokuBaseUrl();
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const requestTarget =
    (process.env.DOKU_QRIS_ENDPOINT || '').trim() || '/checkout/v1/payment';

  const webhookUrl = 'https://rizzflow-theta.vercel.app/api/webhooks/doku';

  const requestBodyObj = {
    order: {
      amount: Math.round(params.amount),
      invoice_number: params.invoiceNumber,
      currency: 'IDR',
      callback_url: 'https://rizzflow-theta.vercel.app/checkout',
      notification_url: webhookUrl,
    },
    payment: {
      payment_due_date: 60,
      payment_method_types: ['QRIS'],
    },
    customer: {
      id: params.customerEmail,
      name: params.customerEmail.split('@')[0] || 'Customer',
      email: params.customerEmail,
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

  const data = (await response.json()) as {
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
  };

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
    throw new Error('Respons DOKU tidak menyertakan URL/kode QRIS.');
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