import nodemailer from 'nodemailer';

export interface PurchasedFileLink {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

function createGmailTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(
    /\s+/g,
    ''
  );

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
 * Mengirimkan email produk digital dengan format Dual Multipart (Plain-Text + HTML)
 * dan subjek transaksi personal agar masuk ke Kotak Masuk Utama (Primary Inbox).
 */
export async function sendProductDeliveryEmail(params: {
  toEmail: string;
  invoiceNumber: string;
  totalPaid: number;
  files: PurchasedFileLink[];
}): Promise<void> {
  const mailSetup = createGmailTransporter();
  if (!mailSetup) {
    console.warn('GMAIL_USER atau GMAIL_APP_PASSWORD belum diisi.');
    return;
  }

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
      <div style="padding: 14px; border: 1px solid #E2E8F0; border-radius: 10px; margin-bottom: 10px; background-color: #F8FAFC;">
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F172A; font-size: 15px;">
          ${item.productTitle} (x${item.quantity})
        </p>
        <a href="${item.signedDownloadUrl}"
           style="display: inline-block; background-color: #10B981; color: #FFFFFF; text-decoration: none; padding: 9px 16px; border-radius: 8px; font-weight: 600; font-size: 13px;">
          Buka dan Unduh Produk
        </a>
      </div>
    `
    )
    .join('');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px; color: #0F172A; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;">
      <p style="font-size: 15px; margin-top: 0;">Halo,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Terima kasih atas pembelianmu di <strong>RizzFlow</strong>. Pembayaran untuk pesanan <strong>${params.invoiceNumber}</strong> (Rp${params.totalPaid.toLocaleString('id-ID')}) telah berhasil kami terima.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Silakan gunakan tombol di bawah ini untuk mengakses produk digitalmu:
      </p>
      <div style="margin: 18px 0;">
        ${fileListHtml}
      </div>
      <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin-top: 20px; border-top: 1px solid #E2E8F0; padding-top: 12px;">
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
 * Mengirimkan email update status untuk Produk Tipe Langganan (Kode Antrian 4 Angka).
 */
export async function sendSubscriptionStatusEmail(params: {
  toEmail: string;
  customerName: string;
  code: string;
  productTitle: string;
  status: 'STOK_TERSEDIA' | 'DIPROSES' | 'DIBATALKAN';
  adminNote?: string;
  deliveredAccount?: string;
}): Promise<void> {
  const mailSetup = createGmailTransporter();
  if (!mailSetup) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || '[https://rizzflow.vercel.app](https://rizzflow.vercel.app)';

  let subject = `Update Kode Antrian ${params.code} - ${params.productTitle}`;
  let statusHeadline = '';
  let statusBody = '';

  if (params.status === 'STOK_TERSEDIA') {
    subject = `Stok Tersedia untuk Kode Antrian ${params.code} (${params.productTitle})`;
    statusHeadline = 'Stok Produk Langganan Tersedia!';
    statusBody = `Admin RizzFlow telah mengonfirmasi bahwa stok untuk ${params.productTitle} saat ini TERSEDIA. Silakan buka website RizzFlow dan masukkan Kode Antrian 4 Angka kamu (${params.code}) untuk melanjutkan pembayaran via QRIS.`;
  } else if (params.status === 'DIPROSES') {
    subject = `Pesanan Langganan Diproses - Kode ${params.code} (${params.productTitle})`;
    statusHeadline = 'Pesanan Kamu Sedang Diproses / Akun Siap Digunakan';
    statusBody = `Terima kasih! Pesanan langganan ${params.productTitle} dengan kode ${params.code} sudah berstatus DIPROSES.`;
  } else {
    subject = `Pemberitahuan Pembatalan Kode Antrian ${params.code} (${params.productTitle})`;
    statusHeadline = 'Pesanan Langganan Dibatalkan';
    statusBody = `Mohon maaf, pesanan antrian kode ${params.code} untuk produk ${params.productTitle} telah dibatalkan karena batas waktu tunggu habis atau stok sedang kosong.`;
  }

  const plainText =
    `Halo ${params.customerName},\n\n` +
    `${statusHeadline}\n` +
    `${statusBody}\n\n` +
    (params.adminNote ? `Keterangan Admin:\n${params.adminNote}\n\n` : '') +
    (params.deliveredAccount
      ? `Detail Akun / Produk Langganan Kamu:\n${params.deliveredAccount}\n\n`
      : '') +
    `Cek langsung dengan memasukkan kode ${params.code} di website: ${appUrl}\n\n` +
    `Salam hangat,\nTim RizzFlow`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px; color: #0F172A; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;">
      <p style="font-size: 15px; margin-top: 0;">Halo <strong>${params.customerName}</strong>,</p>
      <div style="padding: 12px 16px; border-radius: 10px; background-color: #ECFDF5; border: 1px solid #A7F3D0; margin-bottom: 14px;">
        <span style="font-size: 12px; color: #059669; font-weight: 700;">KODE ANTRIAN LANGGANAN: ${params.code}</span>
        <h3 style="margin: 4px 0 0 0; color: #0F172A; font-size: 16px;">${statusHeadline}</h3>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        ${statusBody}
      </p>
      ${
        params.adminNote
          ? `<div style="padding: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 12px 0; font-size: 13px;">
              <strong>Keterangan Admin:</strong><br/>${params.adminNote}
             </div>`
          : ''
      }
      ${
        params.deliveredAccount
          ? `<div style="padding: 14px; background-color: #ECFDF5; border: 1px solid #10B981; border-radius: 10px; margin: 14px 0; font-size: 14px; white-space: pre-line;">
              <strong style="color: #059669;">Detail Akun / Akses Langganan Kamu:</strong><br/>${params.deliveredAccount}
             </div>`
          : ''
      }
      <p style="font-size: 13px; color: #475569; margin-top: 16px;">
        Kamu juga bisa mengecek status dan menyalin detail pesananmu kapan saja dengan memasukkan kode <strong>${params.code}</strong> di halaman utama <a href="${appUrl}" style="color: #10B981; font-weight: 700;">RizzFlow</a>.
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