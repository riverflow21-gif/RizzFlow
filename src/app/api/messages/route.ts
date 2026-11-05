import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSupabaseAdmin,
  getStoredCustomerMessages,
  saveStoredCustomerMessages,
  getStoredCustomServiceConfig,
  saveStoredCustomServiceConfig,
  getStoredCustomProjectOrders,
  saveStoredCustomProjectOrders,
  buildProductDeliveryItems,
  sendAdminTelegramNotification,
  CustomerSupportMessage,
  CustomServiceConfig,
  CustomProjectOrder,
} from '@/lib/supabase';
import { createDokuQrisPayment } from '@/lib/doku';
import { sendCustomOrderEmail } from '@/lib/email';

async function verifyAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data?.user);
}

function generateCustomOrderCode(existing: CustomProjectOrder[]): string {
  const used = new Set(existing.map((o) => o.order_code));
  for (let i = 0; i < 50; i++) {
    const code = `KST-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!used.has(code)) return code;
  }
  return `KST-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicConfig = searchParams.get('config') === '1';
    const orderCodeParam = (searchParams.get('order_code') || '')
      .trim()
      .toUpperCase();

    // 1. Jika pengunjung mengambil konfigurasi Layanan Kustom untuk tampilan toko
    if (isPublicConfig) {
      const config = await getStoredCustomServiceConfig();
      return NextResponse.json({
        customServiceConfig: {
          title: config.title,
          description: config.description,
          services: config.services,
          admin_whatsapp: config.admin_whatsapp,
          admin_telegram: config.admin_telegram,
        },
      });
    }

    // 2. Jika pelanggan mengecek Kode Pesanan Layanan Kustom (Contoh: KST-4829)
    if (orderCodeParam) {
      const allCustomOrders = await getStoredCustomProjectOrders();
      const found = allCustomOrders.find(
        (o) => o.order_code.toUpperCase() === orderCodeParam
      );

      if (!found) {
        return NextResponse.json(
          {
            error: `Kode Pesanan Kustom "${orderCodeParam}" tidak ditemukan. Pastikan penulisan kode sudah benar.`,
          },
          { status: 404 }
        );
      }

      // Jika sudah LUNAS, buatkan tautan unduhan (Signed URL) agar bisa langsung diunduh di layar
      let unlockedFiles: {
        productTitle: string;
        quantity: number;
        signedDownloadUrl: string;
      }[] = [];

      if (found.payment_status === 'PAID') {
        const rawDeliverable = JSON.stringify({
          files: found.file_paths,
          links: found.delivery_links,
        });
        unlockedFiles = await buildProductDeliveryItems({
          productTitle: found.project_title,
          quantity: 1,
          rawFilePath: rawDeliverable,
        });
      }

      return NextResponse.json({
        customOrder: found,
        unlockedFiles,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    // 3. Jika Admin mengambil seluruh data Pesan, Antrian Layanan Kustom, & Konfigurasi
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const [messages, customServiceConfig, customOrders] = await Promise.all([
      getStoredCustomerMessages(),
      getStoredCustomServiceConfig(),
      getStoredCustomProjectOrders(),
    ]);

    return NextResponse.json({
      messages,
      customServiceConfig,
      customOrders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: 'SEND_MESSAGE' | 'GENERATE_CUSTOM_QRIS' | 'CONFIRM_CUSTOM_PAYMENT';
      type?: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
      sender_name?: string;
      sender_email?: string;
      sender_contact?: string;
      invoice_number?: string;
      project_title?: string;
      message?: string;
      order_code?: string;
    };

    const action = body.action || 'SEND_MESSAGE';

    // A. PELANGGAN MEMBUAT QRIS UNTUK MEMBAYAR TAGIHAN LAYANAN KUSTOM
    if (action === 'GENERATE_CUSTOM_QRIS') {
      const code = (body.order_code || '').trim().toUpperCase();
      const allCustomOrders = await getStoredCustomProjectOrders();
      const target = allCustomOrders.find((o) => o.order_code === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode pesanan tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (target.status !== 'SIAP_DIBAYAR' || target.price <= 0) {
        return NextResponse.json(
          { error: 'Tagihan pesanan ini belum siap dibayar.' },
          { status: 400 }
        );
      }

      const invoiceNum = `INV-${target.order_code}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const qrisRes = await createDokuQrisPayment({
        invoiceNumber: invoiceNum,
        amount: target.price,
        customerEmail: target.customer_email,
      });

      const updatedOrders = allCustomOrders.map((o) =>
        o.order_code === code
          ? {
              ...o,
              qris_string: qrisRes.qris_string,
              invoice_number: invoiceNum,
              payment_status: 'PENDING' as const,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);
      const updatedTarget = updatedOrders.find((o) => o.order_code === code);

      return NextResponse.json({
        customOrder: updatedTarget,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    // B. PELANGGAN MELUNASI TAGIHAN LAYANAN KUSTOM -> KIRIM FILE OTOMATIS & CATAT PENDAPATAN
    if (action === 'CONFIRM_CUSTOM_PAYMENT') {
      const code = (body.order_code || '').trim().toUpperCase();
      const allCustomOrders = await getStoredCustomProjectOrders();
      const target = allCustomOrders.find((o) => o.order_code === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode pesanan tidak ditemukan.' },
          { status: 404 }
        );
      }

      const updatedOrders = allCustomOrders.map((o) =>
        o.order_code === code
          ? {
              ...o,
              status: 'LUNAS' as const,
              payment_status: 'PAID' as const,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);
      const paidTarget = updatedOrders.find((o) => o.order_code === code)!;

      // Masukkan ke tabel orders agar terhitung di Dashboard Pendapatan Admin
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin.from('orders').insert({
        invoice_number:
          paidTarget.invoice_number || `INV-${paidTarget.order_code}-${Date.now()}`,
        customer_email: paidTarget.customer_email,
        subtotal_amount: paidTarget.price,
        discount_amount: 0,
        final_amount: paidTarget.price,
        payment_status: 'PAID',
        qris_string: paidTarget.qris_string,
        qris_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        paid_at: new Date().toISOString(),
      });

      const rawDeliverable = JSON.stringify({
        files: paidTarget.file_paths,
        links: paidTarget.delivery_links,
      });
      const unlockedFiles = await buildProductDeliveryItems({
        productTitle: paidTarget.project_title,
        quantity: 1,
        rawFilePath: rawDeliverable,
      });

      try {
        await sendCustomOrderEmail({
          type: 'PAID_DELIVERY',
          toEmail: paidTarget.customer_email,
          customerName: paidTarget.customer_name,
          orderCode: paidTarget.order_code,
          projectTitle: paidTarget.project_title,
          price: paidTarget.price,
          adminNote: paidTarget.admin_note,
          files: unlockedFiles,
        });
      } catch (e) {
        console.error('Gagal kirim email produk kustom lunas:', e);
      }

      await sendAdminTelegramNotification(
        `💰 *TAGIHAN LAYANAN KUSTOM LUNAS!*\n\n` +
          `🔑 Kode Pesanan: *${paidTarget.order_code}*\n` +
          `✨ Proyek: ${paidTarget.project_title}\n` +
          `👤 Pelanggan: ${paidTarget.customer_name} (${paidTarget.customer_email})\n` +
          `💵 Nominal Lunas: *Rp${paidTarget.price.toLocaleString('id-ID')}*\n\n` +
          `File produk kustom telah otomatis dikirim ke pelanggan!`
      );

      return NextResponse.json({
        customOrder: paidTarget,
        unlockedFiles,
      });
    }

    // C. PELANGGAN MENGIRIM PESAN / MEMESAN LAYANAN KUSTOM BARU
    const senderName = (body.sender_name || '').trim();
    const senderEmail = (body.sender_email || '').trim().toLowerCase();
    const senderContact = (body.sender_contact || '').trim();
    const invoiceNumber = (body.invoice_number || '').trim();
    const projectTitle =
      (body.project_title || '').trim() || 'Pesanan Layanan Digital Kustom';
    const messageText = (body.message || '').trim();
    const msgType = body.type || 'LAYANAN_KHUSUS';

    if (!senderName || !senderEmail || !messageText) {
      return NextResponse.json(
        { error: 'Nama, alamat email, dan rincian pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let createdCustomOrder: CustomProjectOrder | null = null;

    // Jika tipe pesan adalah LAYANAN_KHUSUS, buatkan Kode Pesanan Kustom (KST-XXXX)
    if (msgType === 'LAYANAN_KHUSUS') {
      const existingOrders = await getStoredCustomProjectOrders();
      const orderCode = generateCustomOrderCode(existingOrders);

      createdCustomOrder = {
        id: crypto.randomUUID(),
        order_code: orderCode,
        customer_name: senderName,
        customer_email: senderEmail,
        customer_contact: senderContact,
        project_title: projectTitle,
        request_details: messageText,
        price: 0,
        admin_note:
          'Pesanan layanan kustom kamu sedang ditinjau & dikerjakan oleh tim Admin RizzFlow.',
        file_paths: [],
        delivery_links: [],
        status: 'MENUNGGU_PENGERJAAN',
        payment_status: 'UNPAID',
        qris_string: null,
        invoice_number: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      await saveStoredCustomProjectOrders([
        createdCustomOrder,
        ...existingOrders,
      ]);

      try {
        await sendCustomOrderEmail({
          type: 'CREATED',
          toEmail: senderEmail,
          customerName: senderName,
          orderCode: createdCustomOrder.order_code,
          projectTitle: createdCustomOrder.project_title,
        });
      } catch (e) {
        console.error('Gagal kirim email kode pesanan kustom:', e);
      }
    }

    const existingMessages = await getStoredCustomerMessages();
    const newMsg: CustomerSupportMessage = {
      id: crypto.randomUUID(),
      type: msgType,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_contact: senderContact,
      invoice_number: createdCustomOrder
        ? createdCustomOrder.order_code
        : invoiceNumber,
      message: messageText,
      status: 'BARU',
      created_at: nowIso,
    };

    await saveStoredCustomerMessages([newMsg, ...existingMessages]);

    // Kirim Notifikasi Telegram ke Admin
    const typeLabel =
      msgType === 'LAYANAN_KHUSUS'
        ? `✨ *PESANAN LAYANAN KUSTOM BARU (${createdCustomOrder?.order_code})*`
        : msgType === 'KLAIM_GARANSI'
        ? `🛡️ *KLAIM GARANSI BARU*`
        : `💬 *PERTANYAAN PELANGGAN BARU*`;

    await sendAdminTelegramNotification(
      `${typeLabel}\n\n` +
        `👤 Nama: *${senderName}*\n` +
        `📧 Email: ${senderEmail}\n` +
        `📱 WA: ${senderContact || '-'}\n` +
        (createdCustomOrder
          ? `🔑 Kode Pesanan: *${createdCustomOrder.order_code}*\n🎯 Layanan: ${projectTitle}\n`
          : invoiceNumber
          ? `🧾 Invoice: #${invoiceNumber}\n`
          : '') +
        `\n📝 *Pesan:*\n${messageText}`
    );

    return NextResponse.json({
      success: true,
      customOrder: createdCustomOrder,
      message: createdCustomOrder
        ? `Pesanan Layanan Kustom berhasil dibuat dengan kode ${createdCustomOrder.order_code}! Kode juga telah dikirim ke emailmu.`
        : 'Pesan kamu berhasil dikirim ke Admin RizzFlow!',
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
      telegram_bot_token: (body.telegram_bot_token || '').trim(),
      telegram_chat_id: (body.telegram_chat_id || '').trim(),
    };

    await saveStoredCustomServiceConfig(newConfig);
    return NextResponse.json({
      success: true,
      customServiceConfig: newConfig,
      message:
        'Pengaturan Layanan Kustom, Kontak & Bot Telegram berhasil disimpan!',
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

    const body = (await request.json()) as {
      target_type?: 'MESSAGE' | 'CUSTOM_ORDER';
      id?: string;
      status?: string;
      price?: number;
      admin_note?: string;
      file_paths?: string[];
      delivery_links?: string[];
    };

    // 1. Jika Admin mengunggah produk kustom yang sudah selesai & mengirim tagihan ke pelanggan
    if (body.target_type === 'CUSTOM_ORDER') {
      const allOrders = await getStoredCustomProjectOrders();
      const target = allOrders.find((o) => o.id === body.id);
      if (!target) {
        return NextResponse.json(
          { error: 'Data pesanan kustom tidak ditemukan.' },
          { status: 404 }
        );
      }

      const nextStatus =
        (body.status as CustomProjectOrder['status']) || 'SIAP_DIBAYAR';
      const nextPrice =
        typeof body.price === 'number' ? Math.max(0, body.price) : target.price;
      const nextNote =
        body.admin_note !== undefined
          ? body.admin_note.trim()
          : target.admin_note;
      const nextFiles = Array.isArray(body.file_paths)
        ? body.file_paths
        : target.file_paths;
      const nextLinks = Array.isArray(body.delivery_links)
        ? body.delivery_links
        : target.delivery_links;

      const updatedOrders = allOrders.map((o) =>
        o.id === body.id
          ? {
              ...o,
              status: nextStatus,
              price: nextPrice,
              admin_note: nextNote,
              file_paths: nextFiles,
              delivery_links: nextLinks,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);

      if (nextStatus === 'SIAP_DIBAYAR') {
        try {
          await sendCustomOrderEmail({
            type: 'BILL_READY',
            toEmail: target.customer_email,
            customerName: target.customer_name,
            orderCode: target.order_code,
            projectTitle: target.project_title,
            price: nextPrice,
            adminNote: nextNote,
          });
        } catch (e) {
          console.error('Gagal kirim email tagihan kustom:', e);
        }
      }

      return NextResponse.json({
        success: true,
        customOrders: updatedOrders,
        message: `Pesanan ${target.order_code} berhasil ditandai selesai & email tagihan telah dikirim ke pelanggan!`,
      });
    }

    // 2. Jika Admin mengubah status Pesan Biasa / Klaim Garansi
    const messages = await getStoredCustomerMessages();
    const updated = messages.map((m) =>
      m.id === body.id
        ? {
            ...m,
            status: (body.status === 'SELESAI' ? 'SELESAI' : 'BARU') as
              | 'BARU'
              | 'SELESAI',
          }
        : m
    );

    await saveStoredCustomerMessages(updated);
    return NextResponse.json({ success: true, messages: updated });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memperbarui status.' },
      { status: 500 }
    );
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
    const type = searchParams.get('type');

    if (type === 'CUSTOM_ORDER') {
      const orders = await getStoredCustomProjectOrders();
      const updated = orders.filter((o) => o.id !== id);
      await saveStoredCustomProjectOrders(updated);
      return NextResponse.json({ success: true, customOrders: updated });
    }

    const messages = await getStoredCustomerMessages();
    const updated = messages.filter((m) => m.id !== id);
    await saveStoredCustomerMessages(updated);

    return NextResponse.json({ success: true, messages: updated });
  } catch {
    return NextResponse.json(
      { error: 'Gagal menghapus data.' },
      { status: 500 }
    );
  }
}