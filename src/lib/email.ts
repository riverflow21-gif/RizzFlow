import nodemailer from 'nodemailer';

export interface PurchasedFileLink {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

function createGmailTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '')
    .split(' ')
    .join('');

  if (!gmailUser || !gmailAppPassword) {
    return null;
  }

  return {
    gmailUser,
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    }),
  };
}

/**
 * Mengirimkan email produk digital instan (Dual Multipart Text + HTML Anti-Spam).
 */
export async function sendProductDeliveryEmail(params: {
  toEmail: string;
  invoiceNumber: string;
  totalPaid: number;
  files: PurchasedFileLink[];
}): Promise<void> {
  const mailSetup = createGmailTransporter();
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
    to: params.toEmail,
    subject: `Pesanan RizzFlow kamu sudah siap diakses (${params.invoiceNumber})`,
    text: plainTextContent,
    html: htmlContent,
    headers: {
      'X-Priority': '1',
      Importance: 'high',
    },
  });
}

/**
 * Mengirimkan email untuk Transaksi Layanan Kustom:
 * - CREATED: Mengirim Kode Pesanan Kustom saat pelanggan baru memesan.
 * - BILL_READY: Mengabari bahwa produk kustom sudah selesai & siap dibayar dengan Kode Pesanan.
 * - PAID_DELIVERY: Mengirim file produk kustom setelah tagihan dibayar lunas.
 */
export async function sendCustomOrderEmail(params: {
  type: 'CREATED' | 'BILL_READY' | 'PAID_DELIVERY';
  toEmail: string;
  customerName: string;
  orderCode: string;
  projectTitle: string;
  price?: number;
  adminNote?: string;
  files?: PurchasedFileLink[];
}): Promise<void> {
  const mailSetup = createGmailTransporter();
  if (!mailSetup) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://rizzflow-theta.vercel.app';

  let subject = `Kode Pesanan Layanan Kustom RizzFlow (${params.orderCode})`;
  let headline = '';
  let bodyParagraph = '';

  if (params.type === 'CREATED') {
    subject = `Kode Pesanan Layanan Kustom RizzFlow kamu: ${params.orderCode}`;
    headline = 'Permintaan Layanan Kustom Kamu Telah Kami Terima';
    bodyParagraph = `Terima kasih telah memesan layanan kustom di RizzFlow. Simpan Kode Pesanan kamu: ${params.orderCode}. Begitu produk kustom kamu selesai dikerjakan, kami akan mengirimkan email pemberitahuan dan kamu bisa mengakses serta membayarnya menggunakan kode tersebut.`;
  } else if (params.type === 'BILL_READY') {
    subject = `Pesanan Kustom ${params.orderCode} Sudah Selesai dan Siap Diakses`;
    headline = 'Produk Kustom Kamu Sudah Selesai Dikerjakan!';
    bodyParagraph = `Kabar gembira! Pesanan layanan kustom "${params.projectTitle}" dengan kode ${params.orderCode} telah selesai kami siapkan dengan total tagihan Rp${(params.price || 0).toLocaleString('id-ID')}. Silakan buka menu Layanan di website RizzFlow lalu masukkan kode ${params.orderCode} untuk menyelesaikan pembayaran QRIS dan mengunduh produkmu.`;
  } else {
    subject = `File Produk Kustom RizzFlow Kamu (${params.orderCode})`;
    headline = 'Pembayaran Lunas — Berikut File Produk Kustom Kamu';
    bodyParagraph = `Terima kasih! Pembayaran untuk pesanan kustom ${params.orderCode} telah kami terima. Silakan unduh hasil pengerjaan produk kustom kamu melalui tombol di bawah ini:`;
  }

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
    (params.adminNote ? `Catatan Admin:\n${params.adminNote}\n\n` : '') +
    `Buka Website RizzFlow: ${appUrl}\n\n` +
    `Salam hangat,\nTim RizzFlow`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 22px; color: #0F2A1D; background-color: #FFFFFF; border: 1px solid #AEC3B0; border-radius: 16px;">
      <p style="font-size: 15px; margin-top: 0;">Halo <strong>${params.customerName}</strong>,</p>
      <div style="padding: 14px 16px; border-radius: 12px; background-color: #E3EED4; border: 1px solid #6B9071; margin-bottom: 14px;">
        <span style="font-size: 11px; color: #375534; font-weight: 800;">KODE PESANAN LAYANAN KUSTOM</span>
        <div style="font-size: 22px; font-weight: 800; color: #0F2A1D; letter-spacing: 1px; margin-top: 2px;">${params.orderCode}</div>
      </div>
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0F2A1D;">${headline}</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #375534;">${bodyParagraph}</p>
      ${
        params.adminNote
          ? `<div style="padding: 12px; background-color: #F6F8F3; border: 1px solid #AEC3B0; border-radius: 10px; margin: 12px 0; font-size: 13px; color: #0F2A1D;">
              <strong>Catatan Admin:</strong><br/>${params.adminNote}
             </div>`
          : ''
      }
      ${filesHtml}
      <p style="font-size: 12px; color: #6B9071; margin-top: 18px; border-top: 1px solid #E3EED4; padding-top: 12px;">
        Akses halaman Layanan Kustom di <a href="${appUrl}" style="color: #375534; font-weight: 700;">RizzFlow</a> dan masukkan kode <strong>${params.orderCode}</strong>.
      </p>
    </div>
  `;

  await mailSetup.transporter.sendMail({
    from: `"RizzFlow" <${mailSetup.gmailUser}>`,
    replyTo: mailSetup.gmailUser,
    to: params.toEmail,
    subject,
    text: plainText,
    html: htmlContent,
    headers: {
      'X-Priority': '1',
      Importance: 'high',
    },
  });
}