import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSupabaseAdmin,
  generateProductSignedUrl,
  getStoredCustomerMessages,
  saveStoredCustomerMessages,
  getStoredCustomServiceConfig,
  saveStoredCustomServiceConfig,
  getStoredCustomProjectOrders,
  saveStoredCustomProjectOrders,
  sendAdminTelegramNotification,
  CustomerSupportMessage,
  CustomServiceConfig,
  CustomProjectOrder,
  CustomOrderStatus,
  DeliveryLinkItem,
} from '@/lib/supabase';
import { createDokuQrisPayment, checkDokuOrderStatus } from '@/lib/doku';
import { sendCustomOrderEmail, PurchasedFileLink } from '@/lib/email';

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
  for (let i = 0; i < 60; i++) {
    const code = `KST-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!used.has(code)) return code;
  }
  return `KST-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function buildCustomOrderDeliveryItems(
  order: CustomProjectOrder
): Promise<DeliveryLinkItem[]> {
  const results: DeliveryLinkItem[] = [];
  const files = Array.isArray(order.file_paths) ? order.file_paths : [];
  const links = Array.isArray(order.delivery_links) ? order.delivery_links : [];
  const total = files.length + links.length;

  for (let i = 0; i < files.length; i++) {
    try {
      const signedUrl = await generateProductSignedUrl(files[i]);
      results.push({
        productTitle:
          total > 1
            ? `${order.project_title} — File ${i + 1}`
            : order.project_title,
        quantity: 1,
        signedDownloadUrl: signedUrl,
      });
    } catch (e) {
      console.error('Gagal buat signed url file kustom:', e);
    }
  }

  for (let j = 0; j < links.length; j++) {
    results.push({
      productTitle:
        links.length > 1 || files.length > 0
          ? `${order.project_title} — Link Akses ${j + 1}`
          : `${order.project_title} (Link Akses Produk)`,
      quantity: 1,
      signedDownloadUrl: links[j],
    });
  }

  return results;
}

/**
 * Menyelesaikan pembayaran tagihan kustom menjadi LUNAS,
 * mencatat pendapatan ke tabel `orders` Admin, mengirim email (jika ada),
 * dan mengirim notifikasi Telegram ke Admin.
 */
async function settleCustomOrderAsPaid(
  allOrders: CustomProjectOrder[],
  targetOrder: CustomProjectOrder
): Promise<{
  settledOrder: CustomProjectOrder;
  unlockedFiles: DeliveryLinkItem[];
}> {
  const nowIso = new Date().toISOString();
  const settledOrder: CustomProjectOrder = {
    ...targetOrder,
    status: 'LUNAS',
    payment_status: 'PAID',
    admin_note:
      targetOrder.admin_note ||
      'Pembayaran tagihan kustom telah diterima! Silakan unduh file produk kustom kamu di bawah ini.',
    updated_at: nowIso,
  };

  const nextOrders = allOrders.map((o) =>
    o.id === targetOrder.id ? settledOrder : o
  );
  await saveStoredCustomProjectOrders(nextOrders);

  // Catat ke tabel `orders` utama agar masuk Total Pendapatan Lunas di Dashboard Admin
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const invNo =
      settledOrder.invoice_number ||
      `KST-${settledOrder.order_code.replace('KST-', '')}-${Date.now()}`;

    const { data: existingOrd } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('invoice_number', invNo)
      .maybeSingle();

    if (!existingOrd) {
      await supabaseAdmin.from('orders').insert({
        invoice_number: invNo,
        customer_email:
          settledOrder.customer_email ||
          `${settledOrder.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'klien'}@kustom.rizzflow`,
        subtotal_amount: settledOrder.price,
        discount_amount: 0,
        final_amount: settledOrder.price,
        payment_status: 'PAID',
        qris_string: settledOrder.qris_string,
        qris_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        paid_at: nowIso,
      });
    }
  } catch (e) {
    console.error('Gagal mencatat pendapatan layanan kustom ke orders:', e);
  }

  const unlockedFiles = await buildCustomOrderDeliveryItems(settledOrder);

  // Kirim email otomatis jika email klien diisi
  let emailNote = 'File langsung terbuka di halaman website pelanggan.';
  if (
    settledOrder.customer_email &&
    settledOrder.customer_email.includes('@')
  ) {
    try {
      const emailFiles: PurchasedFileLink[] = unlockedFiles.map((f) => ({
        productTitle: f.productTitle,
        quantity: f.quantity,
        signedDownloadUrl: f.signedDownloadUrl,
      }));
      await sendCustomOrderEmail({
        type: 'PAID_DELIVERY',
        toEmail: settledOrder.customer_email,
        customerName: settledOrder.customer_name,
        orderCode: settledOrder.order_code,
        projectTitle: settledOrder.project_title,
        price: settledOrder.price,
        adminNote: settledOrder.admin_note,
        files: emailFiles,
      });
      emailNote = `✅ File terbuka di web & berhasil dikirim ke email ${settledOrder.customer_email}`;
    } catch (mailErr) {
      console.error('Gagal kirim email produk kustom:', mailErr);
      emailNote =
        'File terbuka langsung di halaman web (pengiriman salinan email gagal).';
    }
  }

  await sendAdminTelegramNotification(
    `✅ *TAGIHAN LAYANAN KUSTOM LUNAS!*\n\n` +
      `🔑 Kode: *${settledOrder.order_code}*\n` +
      `👤 Klien: ${settledOrder.customer_name}\n` +
      `📌 Proyek: *${settledOrder.project_title}*\n` +
      `💵 Total Lunas: *Rp${settledOrder.price.toLocaleString('id-ID')}*\n\n` +
      `📦 *Status Pengiriman:* ${emailNote}`
  );

  return { settledOrder, unlockedFiles };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicConfig = searchParams.get('config') === '1';
    const orderCodeParam = (searchParams.get('order_code') || '')
      .trim()
      .toUpperCase();

    // 1. Konfigurasi publik untuk halaman toko
    if (isPublicConfig) {
      const config = await getStoredCustomServiceConfig();
      return NextResponse.json({
        customServiceConfig: {
          title: config.title,
          description: config.description,
          services: config.services,
          admin_whatsapp: config.admin_whatsapp,
          admin_telegram: config.admin_telegram,
          report_email: config.report_email,
        },
      });
    }

    // 2. Pelanggan mengecek Kode Tagihan Layanan Kustom (KST-XXXX)
    if (orderCodeParam) {
      const allCustomOrders = await getStoredCustomProjectOrders();
      let found = allCustomOrders.find(
        (o) => o.order_code.toUpperCase() === orderCodeParam
      );

      if (!found) {
        return NextResponse.json(
          { error: `Kode Tagihan "${orderCodeParam}" tidak ditemukan.` },
          { status: 404 }
        );
      }

      let unlockedFiles: DeliveryLinkItem[] = [];

      // Cek otomatis langsung ke server resmi DOKU jika QRIS sedang menunggu pembayaran
      if (
        found.status === 'SIAP_DIBAYAR' &&
        found.payment_status === 'PENDING' &&
        found.invoice_number
      ) {
        const liveDokuStatus = await checkDokuOrderStatus(found.invoice_number);
        if (liveDokuStatus === 'SUCCESS') {
          const settled = await settleCustomOrderAsPaid(allCustomOrders, found);
          found = settled.settledOrder;
          unlockedFiles = settled.unlockedFiles;
        }
      } else if (found.status === 'LUNAS') {
        unlockedFiles = await buildCustomOrderDeliveryItems(found);
      }

      return NextResponse.json({
        customOrder: found,
        unlockedFiles,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    // 3. Akses penuh khusus Admin
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const [messages, customOrders, customServiceConfig] = await Promise.all([
      getStoredCustomerMessages(),
      getStoredCustomProjectOrders(),
      getStoredCustomServiceConfig(),
    ]);

    return NextResponse.json({
      messages,
      customOrders,
      customServiceConfig,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?:
        | 'SEND_MESSAGE'
        | 'ADMIN_CREATE_CUSTOM_BILL'
        | 'GENERATE_CUSTOM_QRIS'
        | 'CONFIRM_CUSTOM_PAYMENT';
      type?: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
      sender_name?: string;
      sender_email?: string;
      sender_contact?: string;
      invoice_number?: string;
      message?: string;
      // Field pembuatan tagihan kustom langsung oleh Admin
      customer_name?: string;
      customer_email?: string;
      customer_contact?: string;
      project_title?: string;
      price?: number;
      admin_note?: string;
      file_paths?: string[];
      delivery_links?: string[];
      // Field pembayaran QRIS
      order_code?: string;
    };

    const action = body.action || 'SEND_MESSAGE';

    // =========================================================================
    // 1. ADMIN MEMBUAT TAGIHAN KUSTOM BARU (SETELAH DEAL VIA CHAT WA/TELEGRAM)
    // =========================================================================
    if (action === 'ADMIN_CREATE_CUSTOM_BILL') {
      const isAdmin = await verifyAdminAuth(request);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
      }

      const customerName = (body.customer_name || '').trim();
      const customerEmail = (body.customer_email || '').trim().toLowerCase();
      const customerContact = (body.customer_contact || '').trim();
      const projectTitle = (body.project_title || '').trim();
      const price = Math.max(1, Math.round(Number(body.price) || 0));
      const adminNote =
        (body.admin_note || '').trim() ||
        'Produk kustom kamu sudah selesai dikerjakan. Silakan selesaikan pembayaran QRIS di bawah ini agar file langsung terbuka untuk diunduh.';

      const filePaths = Array.isArray(body.file_paths)
        ? body.file_paths.map((f) => f.trim()).filter((f) => f.length > 0)
        : [];
      const deliveryLinks = Array.isArray(body.delivery_links)
        ? body.delivery_links.map((l) => l.trim()).filter((l) => l.length > 0)
        : [];

      if (!customerName || !projectTitle) {
        return NextResponse.json(
          { error: 'Nama Klien dan Nama Proyek wajib diisi.' },
          { status: 400 }
        );
      }

      if (price < 1) {
        return NextResponse.json(
          { error: 'Harga tagihan minimal Rp1.' },
          { status: 400 }
        );
      }

      const allOrders = await getStoredCustomProjectOrders();
      const orderCode = generateCustomOrderCode(allOrders);
      const nowIso = new Date().toISOString();

      const newOrder: CustomProjectOrder = {
        id: crypto.randomUUID(),
        order_code: orderCode,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_contact: customerContact,
        notify_channel: 'EMAIL',
        project_title: projectTitle,
        request_details: 'Kesepakatan langsung melalui chat dengan Admin.',
        price,
        admin_note: adminNote,
        file_paths: filePaths,
        delivery_links: deliveryLinks,
        status: 'SIAP_DIBAYAR',
        payment_status: 'UNPAID',
        qris_string: null,
        invoice_number: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const nextOrders = [newOrder, ...allOrders];
      await saveStoredCustomProjectOrders(nextOrders);

      // Jika email klien diisi, kirim salinan pemberitahuan tagihan ke emailnya
      if (customerEmail && customerEmail.includes('@')) {
        try {
          await sendCustomOrderEmail({
            type: 'BILL_READY',
            toEmail: customerEmail,
            customerName,
            orderCode,
            projectTitle,
            price,
            adminNote,
          });
        } catch (mailErr) {
          console.error('Gagal kirim email tagihan kustom:', mailErr);
        }
      }

      return NextResponse.json({
        success: true,
        customOrder: newOrder,
        customOrders: nextOrders,
        message: `Tagihan Kustom ${orderCode} berhasil dibuat! Salin kode atau link tagihannya untuk dikirim ke pelanggan.`,
      });
    }

    // =========================================================================
    // 2. PELANGGAN MEMBUAT KODE QRIS UNTUK TAGIHAN KUSTOM (KST-XXXX)
    // =========================================================================
    if (action === 'GENERATE_CUSTOM_QRIS') {
      const code = (body.order_code || '').trim().toUpperCase();
      const allOrders = await getStoredCustomProjectOrders();
      const target = allOrders.find((o) => o.order_code.toUpperCase() === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode tagihan kustom tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (target.status !== 'SIAP_DIBAYAR') {
        return NextResponse.json(
          { error: 'Tagihan ini tidak dalam status siap dibayar.' },
          { status: 400 }
        );
      }

      const safeAmount = Math.max(1, Math.round(target.price));
      const invoiceNumber = `${target.order_code}-${Math.floor(
        100 + Math.random() * 900
      )}`;

      const qrisEmail =
        target.customer_email && target.customer_email.includes('@')
          ? target.customer_email
          : 'klien@rizzflow.store';

      const dokuQris = await createDokuQrisPayment({
        invoiceNumber,
        amount: safeAmount,
        customerEmail: qrisEmail,
      });

      const updatedOrders = allOrders.map((o) =>
        o.id === target.id
          ? {
              ...o,
              qris_string: dokuQris.qris_string,
              invoice_number: invoiceNumber,
              payment_status: 'PENDING' as const,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);
      const updatedTarget = updatedOrders.find((o) => o.id === target.id)!;

      return NextResponse.json({
        success: true,
        customOrder: updatedTarget,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    // =========================================================================
    // 3. SIMULASI PEMBAYARAN TAGIHAN KUSTOM (KHUSUS MODE SIMULASI)
    // =========================================================================
    if (action === 'CONFIRM_CUSTOM_PAYMENT') {
      const isSimMode = process.env.DOKU_SIMULATION_MODE === 'true';
      if (!isSimMode) {
        return NextResponse.json(
          { error: 'Konfirmasi manual hanya aktif pada mode simulasi.' },
          { status: 403 }
        );
      }

      const code = (body.order_code || '').trim().toUpperCase();
      const allOrders = await getStoredCustomProjectOrders();
      const target = allOrders.find((o) => o.order_code.toUpperCase() === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode tagihan tidak ditemukan.' },
          { status: 404 }
        );
      }

      const { settledOrder, unlockedFiles } = await settleCustomOrderAsPaid(
        allOrders,
        target
      );

      return NextResponse.json({
        success: true,
        customOrder: settledOrder,
        unlockedFiles,
      });
    }

    // =========================================================================
    // 4. FORMULIR KLAIM GARANSI & TANYA ADMIN DARI WEBSITE
    // =========================================================================
    const senderName = (body.sender_name || '').trim();
    const senderEmail = (body.sender_email || '').trim().toLowerCase();
    const senderContact = (body.sender_contact || '').trim();
    const invoiceNumber = (body.invoice_number || '').trim();
    const messageText = (body.message || '').trim();
    const msgType =
      body.type === 'KLAIM_GARANSI' ? 'KLAIM_GARANSI' : 'PERTANYAAN';

    if (!senderName || !senderEmail || !messageText) {
      return NextResponse.json(
        { error: 'Nama, alamat email, dan isi pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const existingMessages = await getStoredCustomerMessages();
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

    await saveStoredCustomerMessages([newMsg, ...existingMessages]);

    const label =
      msgType === 'KLAIM_GARANSI' ? '🛡️ KLAIM GARANSI' : '💬 PERTANYAAN KLIEN';

    await sendAdminTelegramNotification(
      `${label}\n\n` +
        `👤 Nama: *${senderName}*\n` +
        `📧 Email: ${senderEmail}\n` +
        `📱 WA/Kontak: ${senderContact || '-'}\n` +
        (invoiceNumber ? `🧾 Invoice: ${invoiceNumber}\n` : '') +
        `\n📝 *Pesan:*\n${messageText}`
    );

    return NextResponse.json({
      success: true,
      message:
        msgType === 'KLAIM_GARANSI'
          ? 'Klaim garansi kamu sudah terkirim ke Admin! Kami akan segera mengecek dan membalasnya.'
          : 'Pertanyaan kamu berhasil dikirim ke Admin! Kami akan segera membalas via email/kontakmu.',
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memproses permintaan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      target?: 'CUSTOM_ORDER' | 'MESSAGE';
      id?: string;
      // Update Tagihan Kustom
      customer_name?: string;
      customer_email?: string;
      project_title?: string;
      price?: number;
      admin_note?: string;
      file_paths?: string[];
      delivery_links?: string[];
      status?: CustomOrderStatus;
      // Update Pesan
      message_status?: 'BARU' | 'SELESAI';
    };

    if (body.target === 'CUSTOM_ORDER') {
      const allOrders = await getStoredCustomProjectOrders();
      const target = allOrders.find((o) => o.id === body.id);

      if (!target) {
        return NextResponse.json(
          { error: 'Data tagihan kustom tidak ditemukan.' },
          { status: 404 }
        );
      }

      // Jika Admin secara manual menandai tagihan sebagai LUNAS
      if (body.status === 'LUNAS' && target.status !== 'LUNAS') {
        const preUpdated: CustomProjectOrder = {
          ...target,
          price:
            body.price !== undefined
              ? Math.max(1, Math.round(Number(body.price) || 1))
              : target.price,
          admin_note:
            body.admin_note !== undefined
              ? body.admin_note.trim()
              : target.admin_note,
          file_paths: Array.isArray(body.file_paths)
            ? body.file_paths.filter((f) => f.trim().length > 0)
            : target.file_paths,
          delivery_links: Array.isArray(body.delivery_links)
            ? body.delivery_links.filter((l) => l.trim().length > 0)
            : target.delivery_links,
        };
        await settleCustomOrderAsPaid(allOrders, preUpdated);
        const freshOrders = await getStoredCustomProjectOrders();
        return NextResponse.json({
          success: true,
          customOrders: freshOrders,
          message: `Tagihan ${target.order_code} berhasil ditandai LUNAS dan file produk telah dibuka untuk klien!`,
        });
      }

      const updatedOrders = allOrders.map((o) =>
        o.id === target.id
          ? {
              ...o,
              customer_name:
                body.customer_name !== undefined
                  ? body.customer_name.trim() || o.customer_name
                  : o.customer_name,
              customer_email:
                body.customer_email !== undefined
                  ? body.customer_email.trim().toLowerCase()
                  : o.customer_email,
              project_title:
                body.project_title !== undefined
                  ? body.project_title.trim() || o.project_title
                  : o.project_title,
              price:
                body.price !== undefined
                  ? Math.max(1, Math.round(Number(body.price) || 1))
                  : o.price,
              admin_note:
                body.admin_note !== undefined
                  ? body.admin_note.trim()
                  : o.admin_note,
              file_paths: Array.isArray(body.file_paths)
                ? body.file_paths.filter((f) => f.trim().length > 0)
                : o.file_paths,
              delivery_links: Array.isArray(body.delivery_links)
                ? body.delivery_links.filter((l) => l.trim().length > 0)
                : o.delivery_links,
              status: body.status || o.status,
              // Reset QRIS jika harga diubah agar pelanggan mendapat nominal QRIS terbaru
              qris_string:
                body.price !== undefined && body.price !== o.price
                  ? null
                  : o.qris_string,
              payment_status:
                body.price !== undefined &&
                body.price !== o.price &&
                o.payment_status !== 'PAID'
                  ? ('UNPAID' as const)
                  : o.payment_status,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);
      return NextResponse.json({
        success: true,
        customOrders: updatedOrders,
        message: `Tagihan kustom ${target.order_code} berhasil diperbarui!`,
      });
    }

    // Update Status Pesan Klaim Garansi / Pertanyaan
    const messages = await getStoredCustomerMessages();
    const updatedMessages = messages.map((m) =>
      m.id === body.id
        ? { ...m, status: body.message_status || 'SELESAI' }
        : m
    );
    await saveStoredCustomerMessages(updatedMessages);

    return NextResponse.json({
      success: true,
      messages: updatedMessages,
      message: 'Status pesan diperbarui.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<CustomServiceConfig> & {
      test_email?: boolean;
    };

    const cleanServices = Array.isArray(body.services)
      ? body.services.map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    const unifiedEmail =
      (body.smtp_email || '').trim() ||
      (body.report_email || '').trim() ||
      'rizzflow55@gmail.com';

    const newConfig: CustomServiceConfig = {
      title: (body.title || '').trim() || 'Layanan Pembuatan Digital Kustom',
      description: (body.description || '').trim(),
      services: cleanServices,
      admin_whatsapp: (body.admin_whatsapp || '').trim(),
      admin_telegram: (body.admin_telegram || '').trim(),
      telegram_bot_token: (body.telegram_bot_token || '').trim(),
      telegram_chat_id: (body.telegram_chat_id || '').trim(),
      report_email: unifiedEmail,
      smtp_email: unifiedEmail,
      smtp_app_password: (body.smtp_app_password || '').trim(),
    };

    await saveStoredCustomServiceConfig(newConfig);

    if (body.test_email) {
      const { sendTestAdminEmail } = await import('@/lib/email');
      const testRes = await sendTestAdminEmail(unifiedEmail);
      return NextResponse.json({
        success: true,
        customServiceConfig: newConfig,
        message: `Pengaturan disimpan & Email Tes BERHASIL dikirim dari ${testRes.senderEmail} ke ${testRes.recipientEmail}!`,
      });
    }

    return NextResponse.json({
      success: true,
      customServiceConfig: newConfig,
      message:
        'Pengaturan Email, Layanan Kustom & Bot Telegram berhasil disimpan!',
    });
  } catch (err) {
    const errMsg =
      err instanceof Error
        ? err.message
        : 'Gagal menyimpan atau mengirim email tes.';
    return NextResponse.json(
      {
        error: `Gagal: ${errMsg}. Pastikan App Password Gmail 16 Digit berasal dari akun Gmail yang kamu tulis di atas!`,
      },
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

    if (type === 'custom_order') {
      const allOrders = await getStoredCustomProjectOrders();
      const updated = allOrders.filter((o) => o.id !== id);
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