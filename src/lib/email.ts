import nodemailer from 'nodemailer';
import { getStoredCustomServiceConfig } from './supabase';

export interface PurchasedFileLink {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

async function createGmailTransporter() {
  const cfg = await getStoredCustomServiceConfig();

  const adminEmail = (cfg.smtp_email || cfg.report_email || '').trim();
  const envEmail = (process.env.GMAIL_USER || '').trim();

  const gmailUser =
    adminEmail && adminEmail !== 'rizzflow10@gmail.com'
      ? adminEmail
      : envEmail || adminEmail;

  const rawPass =
    (cfg.smtp_app_password || '').trim() ||
    (process.env.GMAIL_APP_PASSWORD || '').trim();
  const gmailAppPassword = rawPass.split(' ').join('').trim();

  if (!gmailUser || !gmailAppPassword) {
    throw new Error(
      `Konfigurasi pengirim email (${gmailUser || 'Email kosong'}) belum memiliki App Password Gmail 16 Digit.`
    );
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

/**
 * Mengetes pengiriman email dari halaman Pengaturan Admin.
 */
export async function sendTestAdminEmail(targetEmail?: string): Promise<{
  senderEmail: string;
  recipientEmail: string;
}> {
  const mailSetup = await createGmailTransporter();
  const recipient = (targetEmail || '').trim() || mailSetup.gmailUser;

  await mailSetup.transporter.sendMail({
    from: `RizzFlow <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: recipient,
    subject: 'Konfirmasi pengaturan email RizzFlow',
    text:
      `Halo,\n\n` +
      `Pengaturan email pengirim (${mailSetup.gmailUser}) di toko RizzFlow sudah aktif dan berjalan dengan baik.\n\n` +
      `Salam hangat,\n` +
      `RizzFlow`,
    html: `
      <div dir="ltr" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222222; line-height: 1.6;">
        <p>Halo,</p>
        <p>Pengaturan email pengirim (<strong>${mailSetup.gmailUser}</strong>) di toko RizzFlow sudah aktif dan berjalan dengan baik.</p>
        <p>Pesanan pelanggan selanjutnya akan dikirimkan melalui alamat email ini.</p>
        <br/>
        <p style="margin: 0;">Salam hangat,</p>
        <p style="margin: 0;"><strong>RizzFlow</strong></p>
      </div>
    `,
  });

  return {
    senderEmail: mailSetup.gmailUser,
    recipientEmail: recipient,
  };
}

/**
 * Mengirimkan file produk digital dengan gaya email personal Gmail (<div dir="ltr">)
 * tanpa header promosi/prioritas palsu dan tanpa link domain gratis berlebih
 * agar lolos langsung ke Kotak Masuk Utama (Primary Inbox).
 */
export async function sendProductDeliveryEmail(params: {
  toEmail: string;
  invoiceNumber: string;
  totalPaid: number;
  files: PurchasedFileLink[];
}): Promise<void> {
  const cleanEmail = (params.toEmail || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) return;

  const mailSetup = await createGmailTransporter();

  const plainTextFiles = params.files
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.productTitle} (${item.quantity}x)\nLink akses file: ${item.signedDownloadUrl}`
    )
    .join('\n\n');

  const plainTextContent =
    `Halo,\n\n` +
    `Terima kasih sudah memesan di RizzFlow. Berikut adalah file untuk pesanan kamu (${params.invoiceNumber}):\n\n` +
    `${plainTextFiles}\n\n` +
    `Silakan klik link di atas untuk mengunduh file produkmu. Jika ada pertanyaan atau butuh bantuan, kamu cukup membalas langsung pesan email ini.\n\n` +
    `Salam hangat,\n` +
    `RizzFlow`;

  const fileListHtml = params.files
    .map(
      (item, idx) => `
      <p style="margin: 0 0 12px 0;">
        <strong>${idx + 1}. ${item.productTitle} (${item.quantity}x)</strong><br/>
        File produk: <a href="${item.signedDownloadUrl}" style="color: #1155cc; font-weight: bold; text-decoration: underline;">Klik di sini untuk membuka dan mengunduh file</a>
      </p>
    `
    )
    .join('');

  const htmlContent = `
    <div dir="ltr" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222222; line-height: 1.6;">
      <p>Halo,</p>
      <p>Terima kasih sudah memesan di RizzFlow. Pembayaran untuk pesanan <strong>${params.invoiceNumber}</strong> sudah kami terima.</p>
      <p>Berikut adalah akses untuk mengunduh file produk yang kamu pesan:</p>
      <div style="margin: 16px 0; padding-left: 12px; border-left: 3px solid #375534;">
        ${fileListHtml}
      </div>
      <p>Jika kamu membutuhkan bantuan atau ada kendala saat membuka file, silakan balas langsung email ini.</p>
      <br/>
      <p style="margin: 0;">Salam hangat,</p>
      <p style="margin: 0;"><strong>RizzFlow</strong></p>
    </div>
  `;

  await mailSetup.transporter.sendMail({
    from: `RizzFlow <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: cleanEmail,
    subject: `File pesanan RizzFlow kamu (${params.invoiceNumber})`,
    text: plainTextContent,
    html: htmlContent,
  });
}

/**
 * Mengirimkan email untuk Layanan Kustom dengan format personal bersih
 * agar masuk ke Kotak Masuk Utama (Primary Inbox).
 */
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

  let subject = `Pesanan layanan kustom RizzFlow (${params.orderCode})`;
  let introParagraph = '';
  let stepInstruction = '';

  if (params.type === 'CREATED') {
    subject = `Kode pesanan layanan kustom RizzFlow kamu (${params.orderCode})`;
    introParagraph = `Terima kasih sudah memesan layanan kustom "${params.projectTitle}" di RizzFlow. Kode pesanan kamu adalah ${params.orderCode}.`;
    stepInstruction = `Simpan kode pesanan ${params.orderCode} tersebut untuk melihat progres pengerjaan dan menyelesaikan pembayaran di menu Layanan pada website RizzFlow (rizzflow-theta.vercel.app).`;
  } else if (params.type === 'ACCEPTED_ESTIMATE') {
    subject = `Update pengerjaan pesanan ${params.orderCode} - RizzFlow`;
    introParagraph = `Pesanan layanan kustom "${params.projectTitle}" dengan kode ${params.orderCode} sudah kami terima dan saat ini sedang kami kerjakan.`;
    stepInstruction = `Kamu bisa memantau progresnya kapan saja dengan memasukkan kode ${params.orderCode} di menu Layanan website RizzFlow (rizzflow-theta.vercel.app).`;
  } else if (params.type === 'BILL_READY') {
    subject = `Pesanan kustom ${params.orderCode} sudah selesai dikerjakan`;
    introParagraph = `Pesanan layanan kustom "${params.projectTitle}" dengan kode ${params.orderCode} sudah selesai kami siapkan.`;
    stepInstruction = `Silakan buka menu Layanan di website RizzFlow (rizzflow-theta.vercel.app) lalu masukkan kode pesanan ${params.orderCode} untuk menyelesaikan pembayaran sebesar Rp${(params.price || 0).toLocaleString('id-ID')} dan mengunduh file hasil pengerjaannya.`;
  } else {
    subject = `File hasil pesanan kustom RizzFlow (${params.orderCode})`;
    introParagraph = `Terima kasih, pembayaran untuk pesanan layanan kustom ${params.orderCode} ("${params.projectTitle}") sudah kami terima.`;
    stepInstruction = `Silakan gunakan link di bawah ini untuk mengunduh hasil pengerjaan produk kustom kamu:`;
  }

  const filesHtml =
    params.files && params.files.length > 0
      ? params.files
          .map(
            (f, i) => `
          <p style="margin: 0 0 10px 0;">
            <strong>${i + 1}. ${f.productTitle}</strong><br/>
            Link file: <a href="${f.signedDownloadUrl}" style="color: #1155cc; font-weight: bold; text-decoration: underline;">Klik di sini untuk mengunduh produk kustom</a>
          </p>`
          )
          .join('')
      : '';

  const plainTextFiles =
    params.files && params.files.length > 0
      ? params.files
          .map((f, i) => `${i + 1}. ${f.productTitle}\nLink: ${f.signedDownloadUrl}`)
          .join('\n\n')
      : '';

  const plainText =
    `Halo ${params.customerName},\n\n` +
    `${introParagraph}\n\n` +
    `Kode Pesanan: ${params.orderCode}\n` +
    (params.estimatedCompletion
      ? `Estimasi Selesai: ${params.estimatedCompletion}\n`
      : '') +
    (params.price && params.price > 0
      ? `Nominal Tagihan: Rp${params.price.toLocaleString('id-ID')}\n`
      : '') +
    (params.adminNote ? `Catatan Admin: ${params.adminNote}\n` : '') +
    `\n${stepInstruction}\n\n` +
    (plainTextFiles ? `${plainTextFiles}\n\n` : '') +
    `Jika ada yang ingin ditanyakan, silakan balas langsung email ini.\n\n` +
    `Salam hangat,\n` +
    `RizzFlow`;

  const htmlContent = `
    <div dir="ltr" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222222; line-height: 1.6;">
      <p>Halo <strong>${params.customerName}</strong>,</p>
      <p>${introParagraph}</p>
      <div style="margin: 14px 0; padding: 12px 14px; background-color: #f6f8f3; border-left: 3px solid #375534;">
        <p style="margin: 0 0 4px 0;"><strong>Kode Pesanan:</strong> ${params.orderCode}</p>
        ${
          params.estimatedCompletion
            ? `<p style="margin: 0 0 4px 0;"><strong>Estimasi Selesai:</strong> ${params.estimatedCompletion}</p>`
            : ''
        }
        ${
          params.price && params.price > 0
            ? `<p style="margin: 0 0 4px 0;"><strong>Rincian Biaya:</strong> Rp${params.price.toLocaleString('id-ID')}</p>`
            : ''
        }
        ${
          params.adminNote
            ? `<p style="margin: 0;"><strong>Pesan Admin:</strong> ${params.adminNote}</p>`
            : ''
        }
      </div>
      <p>${stepInstruction}</p>
      ${filesHtml ? `<div style="margin: 14px 0;">${filesHtml}</div>` : ''}
      <p>Jika ada pertanyaan, kamu cukup membalas langsung pesan email ini.</p>
      <br/>
      <p style="margin: 0;">Salam hangat,</p>
      <p style="margin: 0;"><strong>RizzFlow</strong></p>
    </div>
  `;

  await mailSetup.transporter.sendMail({
    from: `RizzFlow <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: cleanEmail,
    subject,
    text: plainText,
    html: htmlContent,
  });

  return true;
}