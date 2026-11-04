import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import {
  getSupabaseAdmin,
  getStoredCustomerMessages,
  saveStoredCustomerMessages,
  getStoredCustomServiceConfig,
  saveStoredCustomServiceConfig,
  CustomerSupportMessage,
  CustomServiceConfig,
} from '@/lib/supabase';

interface CreateMessageBody {
  type?: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
  sender_name?: string;
  sender_email?: string;
  sender_contact?: string;
  invoice_number?: string;
  message?: string;
}

async function verifyAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data?.user);
}

async function notifyOwnerPhone(msg: CustomerSupportMessage) {
  const typeLabel =
    msg.type === 'KLAIM_GARANSI'
      ? '🛡️ KLAIM GARANSI / KENDALA FILE'
      : msg.type === 'LAYANAN_KHUSUS'
      ? '✨ PESANAN LAYANAN KHUSUS (CUSTOM)'
      : '💬 PERTANYAAN PELANGGAN';

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;

  if (tgToken && tgChatId) {
    const textMessage =
      `🔔 *NOTIFIKASI RIZZFLOW*\n` +
      `Kategori: *${typeLabel}*\n\n` +
      `👤 Nama: ${msg.sender_name}\n` +
      `📧 Email: ${msg.sender_email}\n` +
      `📱 WA/Kontak: ${msg.sender_contact || '-'}\n` +
      `🧾 No. Invoice: ${msg.invoice_number || '-'}\n\n` +
      `📝 *Isi Pesan:*\n${msg.message}`;

    try {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: textMessage,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.error('Gagal mengirim notifikasi Telegram:', e);
    }
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `"Sistem RizzFlow" <${gmailUser}>`,
        to: gmailUser,
        replyTo: msg.sender_email,
        subject: `[Pesan Baru RizzFlow] ${typeLabel} dari ${msg.sender_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 540px; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px;">
            <h3 style="color: #10B981; margin-top: 0;">${typeLabel}</h3>
            <p><strong>Nama:</strong> ${msg.sender_name}</p>
            <p><strong>Email:</strong> ${msg.sender_email}</p>
            <p><strong>WhatsApp / Kontak:</strong> ${msg.sender_contact || '-'}</p>
            <p><strong>Nomor Invoice:</strong> ${msg.invoice_number || '-'}</p>
            <div style="background: #F8FAFC; padding: 14px; border-radius: 8px; border: 1px solid #E2E8F0; margin-top: 12px;">
              <strong>Isi Pesan:</strong><br/>
              <p style="white-space: pre-line; margin-bottom: 0;">${msg.message}</p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error('Gagal mengirim email notifikasi admin:', e);
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Jika parameter ?config=1 dipanggil oleh halaman toko, kembalikan pengaturan Layanan Kustom
    if (searchParams.get('config') === '1') {
      const customServiceConfig = await getStoredCustomServiceConfig();
      return NextResponse.json({ customServiceConfig });
    }

    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const [messages, customServiceConfig] = await Promise.all([
      getStoredCustomerMessages(),
      getStoredCustomServiceConfig(),
    ]);

    return NextResponse.json({ messages, customServiceConfig });
  } catch {
    return NextResponse.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateMessageBody;
    const senderName = (body.sender_name || '').trim() || 'Pelanggan RizzFlow';
    const senderEmail = (body.sender_email || '').trim();
    const senderContact = (body.sender_contact || '').trim();
    const invoiceNumber = (body.invoice_number || '').trim();
    const messageText = (body.message || '').trim();
    const msgType = body.type || 'KLAIM_GARANSI';

    if (!senderEmail || !messageText) {
      return NextResponse.json(
        { error: 'Alamat email dan isi pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const newMsg: CustomerSupportMessage = {
      id: crypto.randomUUID(),
      type: msgType,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_contact: senderContact,
      invoice_number: invoiceNumber,
      message: messageText,
      status: 'BARU',
      created_at: new Date().toISOString(),
    };

    const existing = await getStoredCustomerMessages();
    const updated = [newMsg, ...existing];
    await saveStoredCustomerMessages(updated);

    await notifyOwnerPhone(newMsg);

    return NextResponse.json({
      success: true,
      message:
        'Pesan kamu berhasil dikirim! Admin RizzFlow telah menerima notifikasi dan akan segera merespons.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim pesan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<CustomServiceConfig>;
    const cleanServices = Array.isArray(body.services)
      ? body.services.map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    const newConfig: CustomServiceConfig = {
      title: (body.title || '').trim() || 'Layanan Pembuatan Digital Kustom',
      description: (body.description || '').trim(),
      services: cleanServices,
      admin_whatsapp: (body.admin_whatsapp || '').trim(),
      admin_telegram: (body.admin_telegram || '').trim(),
    };

    await saveStoredCustomServiceConfig(newConfig);
    return NextResponse.json({
      success: true,
      customServiceConfig: newConfig,
      message: 'Pengaturan Layanan Kustom, Nomor WA & Link Telegram berhasil disimpan!',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan Layanan Kustom.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string; status?: 'BARU' | 'SELESAI' };
    const existing = await getStoredCustomerMessages();
    const updated = existing.map((m) =>
      m.id === body.id ? { ...m, status: body.status || 'SELESAI' } : m
    );
    await saveStoredCustomerMessages(updated);

    return NextResponse.json({ success: true, messages: updated });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status pesan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const existing = await getStoredCustomerMessages();
    const updated = existing.filter((m) => m.id !== id);
    await saveStoredCustomerMessages(updated);

    return NextResponse.json({ success: true, messages: updated });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus pesan.' }, { status: 500 });
  }
}