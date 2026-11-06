import nodemailer from 'nodemailer';
import { getStoredCustomServiceConfig } from './supabase';

export interface PurchasedFileLink {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

async function createGmailTransporter() {
  const cfg = await getStoredCustomServiceConfig();

  const gmailUser = (cfg.smtp_email || process.env.GMAIL_USER || '').trim();
  const rawPass = cfg.smtp_app_password || process.env.GMAIL_APP_PASSWORD || '';
  const gmailAppPassword = rawPass.split(' ').join('').trim();

  if (!gmailUser || !gmailAppPassword) {
    console.warn('Email pengirim (Gmail User / App Password) belum diatur.');
    return null;
  }

  return {
    gmailUser,
    transporter: nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    }),
  };
}

export async function sendProductDeliveryEmail(params: {
  toEmail: string;
  invoiceNumber: string;
  totalPaid: number;
  files: PurchasedFileLink[];
}): Promise<void> {
  const cleanEmail = (params.toEmail || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) return;

  const mailSetup = await createGmailTransporter();
  if (!mailSetup) return;

  const plainTextFiles = params.files
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.productTitle} (x${item.quantity})\nLink Unduh: ${item.signedDownloadUrl}`
    )
    .join('\n\n');

  const plainTextContent =
    `Halo,\n\n` +
    `Terima kasih telah berbelanja di RizzFlow. Pembayaran untuk pesanan ${params.invoiceNumber} sebesar Rp${params.totalPaid.toLocaleString('id-ID')} sudah kami terima.\n\n` +
    `Berikut adalah link akses produk digital yang kamu pesan:\n\n` +
    `${plainTextFiles}\n\n` +
    `Silakan buka link di atas untuk mengunduh file kamu. Jika membutuhkan bantuan, cukup balas langsung email ini.\n\n` +
    `Salam hangat,\nTim RizzFlow`;

  const fileListHtml = params.files
    .map(
      (item) => `
      <div style="padding: 14px; border: 1px solid #AEC3B0; border-radius: 12px; margin-bottom: 10px; background-color: #F6F8F3;">
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F2A1D; font-size: 15px;">
          ${item.productTitle} (x${item.quantity})
        </p>
        <a href="${item.signedDownloadUrl}"
           style="display: inline-block; background-color: #0F2A1D; color: #E3EED4; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: 700; font-size: 13px;">
          Buka dan Unduh Produk
        </a>
      </div>
    `
    )
    .join('');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 22px; color: #0F2A1D; background-color: #FFFFFF; border: 1px solid #AEC3B0; border-radius: 16px;">
      <p style="font-size: 15px; margin-top: 0;">Halo,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #375534;">
        Terima kasih atas pembelianmu di <strong>RizzFlow</strong>. Pembayaran untuk pesanan <strong>${params.invoiceNumber}</strong> (Rp${params.totalPaid.toLocaleString('id-ID')}) telah berhasil kami terima.
      </p>
      <div style="margin: 18px 0;">
        ${fileListHtml}
      </div>
      <p style="color: #6B9071; font-size: 12px; line-height: 1.5; margin-top: 20px; border-top: 1px solid #E3EED4; padding-top: 12px;">
        Jika kamu membutuhkan bantuan, cukup balas langsung pesan email ini.<br/>
        Salam hangat,<br/>
        <strong>RizzFlow</strong>
      </p>
    </div>
  `;

  await mailSetup.transporter.sendMail({
    from: `"RizzFlow" <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: cleanEmail,
    subject: `Pesanan RizzFlow kamu sudah siap diakses (${params.invoiceNumber})`,
    text: plainTextContent,
    html: htmlContent,
    headers: {
      'X-Priority': '1',
      Importance: 'high',
    },
  });
}

export async function sendCustomOrderEmail(params: {
  type: 'CREATED' | 'ACCEPTED_ESTIMATE' | 'BILL_READY' | 'PAID_DELIVERY';
  toEmail: string;
  customerName: string;
  orderCode: string;
  projectTitle: string;
  estimatedCompletion?: string;
  price?: number;
  adminNote?: string;
  files?: PurchasedFileLink[];
}): Promise<boolean> {
  const cleanEmail = (params.toEmail || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return false;
  }

  const mailSetup = await createGmailTransporter();
  if (!mailSetup) return false;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://rizzflow-theta.vercel.app';

  let subject = `Kode Pesanan Layanan Kustom RizzFlow (${params.orderCode})`;
  let headline = '';
  let bodyParagraph = '';

  if (params.type === 'CREATED') {
    subject = `Kode Pesanan Layanan Kustom RizzFlow kamu: ${params.orderCode}`;
    headline = 'Permintaan Layanan Kustom Kamu Telah Kami Terima';
    bodyParagraph = `Terima kasih telah memesan layanan kustom "${params.projectTitle}" di RizzFlow. Simpan Kode Pesanan kamu: ${params.orderCode}. Kamu dapat mengecek progres pengerjaan, estimasi selesai, dan melakukan pembayaran nantinya menggunakan kode tersebut di menu Layanan website RizzFlow.`;
  } else if (params.type === 'ACCEPTED_ESTIMATE') {
    subject = `Pesanan Kustom ${params.orderCode} Diterima dan Sedang Diproses`;
    headline = 'Pesanan Kamu Diterima & Sedang Kami Kerjakan!';
    bodyParagraph = `Admin RizzFlow telah menerima dan mulai memproses pesanan layanan kustom "${params.projectTitle}" dengan kode ${params.orderCode}.`;
  } else if (params.type === 'BILL_READY') {
    subject = `Pesanan Kustom ${params.orderCode} Telah Selesai - Silakan Lakukan Pembayaran`;
    headline = 'Produk Kustom Kamu Sudah Selesai Dikerjakan!';
    bodyParagraph = `Kabar gembira! Pesanan layanan kustom "${params.projectTitle}" dengan kode ${params.orderCode} telah selesai kami siapkan dengan total tagihan Rp${(params.price || 0).toLocaleString('id-ID')}. Silakan buka menu Layanan di website RizzFlow, masukkan kode ${params.orderCode}, dan lakukan pembayaran via QRIS agar file produkmu langsung terkirim otomatis.`;
  } else {
    subject = `File Produk Kustom RizzFlow Kamu (${params.orderCode})`;
    headline = 'Pembayaran Berhasil — Berikut Produk Kustom Kamu';
    bodyParagraph = `Terima kasih! Pembayaran untuk pesanan kustom ${params.orderCode} telah kami terima. Silakan akses dan unduh produk kustom kamu melalui tombol di bawah ini:`;
  }

  const estimateHtml = params.estimatedCompletion
    ? `<div style="padding: 12px 14px; background-color: #E3EED4; border: 1px solid #375534; border-radius: 10px; margin: 12px 0; font-size: 13px; color: #0F2A1D;">
        <strong>⏱️ Estimasi Pengerjaan Sampai Selesai:</strong><br/>
        <span style="font-size: 15px; font-weight: 800; color: #375534;">${params.estimatedCompletion}</span>
       </div>`
    : '';

  const filesHtml =
    params.files && params.files.length > 0
      ? params.files
          .map(
            (f) => `
          <div style="padding: 14px; border: 1px solid #AEC3B0; border-radius: 12px; margin-top: 10px; background-color: #F6F8F3;">
            <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F2A1D; font-size: 14px;">${f.productTitle}</p>
            <a href="${f.signedDownloadUrl}" style="display: inline-block; background-color: #0F2A1D; color: #E3EED4; text-decoration: none; padding: 9px 16px; border-radius: 999px; font-weight: 700; font-size: 12px;">
              Unduh File Produk Kustom
            </a>
          </div>`
          )
          .join('')
      : '';

  const plainText =
    `Halo ${params.customerName},\n\n` +
    `${headline}\n` +
    `Kode Pesanan Kustom: ${params.orderCode}\n\n` +
    `${bodyParagraph}\n\n` +
    (params.estimatedCompletion
      ? `Estimasi Pengerjaan Sampai Selesai: ${params.estimatedCompletion}\n\n`
      : '') +
    (params.price && params.price > 0
      ? `Total Tagihan: Rp${params.price.toLocaleString('id-ID')}\n\n`
      : '') +
    (params.adminNote ? `Pesan / Catatan Admin:\n${params.adminNote}\n\n` : '') +
    `Cek Kode Pesanan di Website RizzFlow: ${appUrl}\n\n` +
    `Salam hangat,\nTim RizzFlow`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 22px; color: #0F2A1D; background-color: #FFFFFF; border: 1px solid #AEC3B0; border-radius: 16px;">
      <p style="font-size: 15px; margin-top: 0;">Halo <strong>${params.customerName}</strong>,</p>
      <div style="padding: 14px 16px; border-radius: 12px; background-color: #0F2A1D; color: #E3EED4; margin-bottom: 14px;">
        <span style="font-size: 11px; color: #AEC3B0; font-weight: 800;">KODE PESANAN LAYANAN KUSTOM KAMU</span>
        <div style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: 1.5px; margin-top: 2px;">${params.orderCode}</div>
      </div>
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0F2A1D;">${headline}</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #375534;">${bodyParagraph}</p>
      ${estimateHtml}
      ${
        params.adminNote
          ? `<div style="padding: 12px; background-color: #F6F8F3; border: 1px solid #AEC3B0; border-radius: 10px; margin: 12px 0; font-size: 13px; color: #0F2A1D;">
              <strong>Keterangan Admin:</strong><br/>${params.adminNote}
             </div>`
          : ''
      }
      ${filesHtml}
      <p style="font-size: 12px; color: #6B9071; margin-top: 18px; border-top: 1px solid #E3EED4; padding-top: 12px;">
        Buka menu <strong>Layanan</strong> di <a href="${appUrl}" style="color: #375534; font-weight: 700;">${appUrl}</a> dan masukkan kode <strong>${params.orderCode}</strong> untuk melihat status atau menyelesaikan pembayaran.
      </p>
    </div>
  `;

  await mailSetup.transporter.sendMail({
    from: `"RizzFlow" <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: cleanEmail,
    subject,
    text: plainText,
    html: htmlContent,
    headers: {
      'X-Priority': '1',
      Importance: 'high',
    },
  });

  return true;
}