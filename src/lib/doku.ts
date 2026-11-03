import crypto from 'crypto';
import { DokuQrisResponse, PromoCode, PromoValidationResult } from '@/types';

/**
 * Menghitung potongan harga berdasarkan aturan kode promo di PRD:
 * 1. Cek apakah promo aktif dan berada dalam rentang waktu mulai s/d berakhir.
 * 2. Hitung diskon = Subtotal * (Persentase / 100).
 * 3. Jika diskon melebihi Maksimal Potongan (Rp), kunci nilai diskon pada batas maksimal tersebut.
 */
export function calculatePromoDiscount(
  subtotal: number,
  promo: PromoCode | null
): PromoValidationResult {
  if (!promo || !promo.is_active) {
    return {
      valid: false,
      message: 'Kode promo tidak ditemukan atau sudah tidak aktif.',
      discount_amount: 0,
      promo_code: null,
    };
  }

  const now = new Date();
  const startsAt = new Date(promo.starts_at);
  const expiresAt = new Date(promo.expires_at);

  if (now < startsAt) {
    return {
      valid: false,
      message: 'Kode promo ini belum memasuki periode aktif.',
      discount_amount: 0,
      promo_code: null,
    };
  }

  if (now > expiresAt) {
    return {
      valid: false,
      message: 'Masa berlaku kode promo ini sudah habis.',
      discount_amount: 0,
      promo_code: null,
    };
  }

  const rawDiscount = Math.floor(subtotal * (promo.discount_percent / 100));
  const cappedDiscount = Math.min(rawDiscount, promo.max_discount_amount);
  const finalDiscount = Math.min(cappedDiscount, subtotal);

  return {
    valid: true,
    message: `Kode promo ${promo.code} berhasil dipasang! Hemat Rp${finalDiscount.toLocaleString('id-ID')}.`,
    discount_amount: finalDiscount,
    promo_code: promo.code,
  };
}

/**
 * Membuat Signature keamanan HMAC-SHA256 sesuai standar DOKU API.
 */
export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  bodyString: string;
  secretKey: string;
}): string {
  const digest = crypto
    .createHash('sha256')
    .update(params.bodyString, 'utf8')
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

/**
 * Meminta pembuatan tagihan QRIS ke DOKU dengan durasi kedaluwarsa tepat 60 menit (1 jam).
 */
export async function createDokuQrisPayment(params: {
  invoiceNumber: string;
  amount: number;
  customerEmail: string;
}): Promise<DokuQrisResponse> {
  // Waktu kedaluwarsa dikunci 60 menit (1 jam) dari waktu pemesanan
  const expiresAtDate = new Date(Date.now() + 60 * 60 * 1000);
  const expiresAtIso = expiresAtDate.toISOString();

  // Jika mode simulasi aktif, hasilkan string QRIS simulasi agar pemilik toko mudah menguji di laptop
  if (process.env.DOKU_SIMULATION_MODE === 'true') {
    const simulatedQrString = `00020101021226610014ID.CO.DOKU.WWW01189360089900000000010215${params.invoiceNumber}520458125303360540${params.amount}5802ID5908RIZZFLOW6007JAKARTA6304ABCD`;
    return {
      qris_string: simulatedQrString,
      expires_at: expiresAtIso,
    };
  }

  const clientId = process.env.DOKU_CLIENT_ID || '';
  const secretKey = process.env.DOKU_SECRET_KEY || '';
  const baseUrl = process.env.DOKU_BASE_URL || 'https://api-sandbox.doku.com';
  const requestTarget = '/checkout/v1/payment';
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';

  const requestBody = {
    order: {
      amount: params.amount,
      invoice_number: params.invoiceNumber,
      currency: 'IDR',
    },
    payment: {
      payment_due_date: 60, // Kedaluwarsa tepat 60 menit (1 jam)
      payment_method_types: ['QRIS'],
    },
    customer: {
      email: params.customerEmail,
    },
  };

  const bodyString = JSON.stringify(requestBody);
  const signature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    bodyString,
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
    body: bodyString,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat QRIS DOKU: ${errText}`);
  }

  const result = (await response.json()) as {
    response?: {
      payment?: {
        qr_string?: string;
        url?: string;
      };
    };
  };

  const qrisString =
    result.response?.payment?.qr_string ||
    result.response?.payment?.url ||
    `RIZZFLOW-QRIS-${params.invoiceNumber}`;

  return {
    qris_string: qrisString,
    expires_at: expiresAtIso,
  };
}

/**
 * Memverifikasi keaslian Signature dari Webhook DOKU agar tidak bisa dipalsukan pihak luar.
 */
export function verifyDokuWebhookSignature(params: {
  clientIdHeader: string;
  requestIdHeader: string;
  requestTimestampHeader: string;
  signatureHeader: string;
  requestTarget: string;
  rawBody: string;
}): boolean {
  if (process.env.DOKU_SIMULATION_MODE === 'true') {
    return true;
  }

  const secretKey = process.env.DOKU_SECRET_KEY || '';
  if (!secretKey) return false;

  const expectedSignature = generateDokuSignature({
    clientId: params.clientIdHeader,
    requestId: params.requestIdHeader,
    requestTimestamp: params.requestTimestampHeader,
    requestTarget: params.requestTarget,
    bodyString: params.rawBody,
    secretKey,
  });

  return params.signatureHeader === expectedSignature;
}