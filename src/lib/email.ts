import { Resend } from 'resend';

export interface PurchasedFileLink {
  productTitle: string;
  quantity: number;
  signedDownloadUrl: string;
}

/**
 * Mengirimkan email berisi tautan unduhan produk digital ke alamat email pelanggan
 * segera setelah pembayaran QRIS terdeteksi lunas.
 */
export async function sendProductDeliveryEmail(params: {
  toEmail: string;
  invoiceNumber: string;
  totalPaid: number;
  files: PurchasedFileLink[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'RizzFlow <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('RESEND_API_KEY belum diisi di .env.local. Email tidak dikirim.');
    return;
  }

  const resend = new Resend(apiKey);

  const fileListHtml = params.files
    .map(
      (item) => `
      <div style="padding: 16px; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 12px; background-color: #F8FAFC;">
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F172A; font-size: 16px;">
          ${item.productTitle} (x${item.quantity})
        </p>
        <a href="${item.signedDownloadUrl}"
           style="display: inline-block; background-color: #10B981; color: #FFFFFF; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Unduh File Produk Sekarang
        </a>
      </div>
    `
    )
    .join('');

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px;">
      <h2 style="color: #10B981; margin-top: 0;">Terima Kasih atas Pembelianmu di RizzFlow!</h2>
      <p style="color: #0F172A; font-size: 15px; line-height: 1.6;">
        Pembayaran untuk pesanan <strong>#${params.invoiceNumber}</strong> sebesar
        <strong>Rp${params.totalPaid.toLocaleString('id-ID')}</strong> telah berhasil kami terima.
      </p>
      <p style="color: #0F172A; font-size: 15px; line-height: 1.6;">
        Silakan klik tombol hijau di bawah ini untuk mengunduh produk digital yang kamu beli:
      </p>
      <div style="margin: 20px 0;">
        ${fileListHtml}
      </div>
      <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 16px;">
        Catatan Keamanan: Tautan unduhan di atas bersifat pribadi dan memiliki batas waktu aktif selama 7 hari. Segera simpan file ke perangkatmu setelah diunduh.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [params.toEmail],
    subject: `[RizzFlow] File Produk Digitalmu Siap Diunduh (#${params.invoiceNumber})`,
    html: htmlContent,
  });

  if (error) {
    throw new Error(`Gagal mengirim email Resend: ${error.message}`);
  }
}