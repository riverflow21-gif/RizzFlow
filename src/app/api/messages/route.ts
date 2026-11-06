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
  sendClientTelegramNotification,
  CustomerSupportMessage,
  CustomServiceConfig,
  CustomProjectOrder,
  CustomNotificationChannel,
} from '@/lib/supabase';
import { createDokuQrisPayment } from '@/lib/doku';
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
  for (let i = 0; i < 50; i++) {
    const code = `KST-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!used.has(code)) return code;
  }
  return `KST-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Mengirim notifikasi ke Klien sesuai saluran yang dipilihnya (EMAIL, TELEGRAM, atau BOTH).
 */
async function dispatchClientCustomNotification(params: {
  order: CustomProjectOrder;
  type: 'CREATED' | 'ACCEPTED_ESTIMATE' | 'BILL_READY' | 'PAID_DELIVERY';
  files?: PurchasedFileLink[];
}): Promise<void> {
  const channel: CustomNotificationChannel =
    params.order.notify_channel || 'EMAIL';
  const sendEmail = channel === 'EMAIL' || channel === 'BOTH';
  const sendTg = channel === 'TELEGRAM' || channel === 'BOTH';

  // Pastikan Bot Telegram selalu mengirim link resmi https://rizzflow-theta.vercel.app
  const rawEnvUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  const appUrl =
    rawEnvUrl &&
    !rawEnvUrl.includes('localhost') &&
    !rawEnvUrl.includes('127.0.0.1')
      ? rawEnvUrl.replace(/\/+$/, '')
      : 'https://rizzflow-theta.vercel.app';

  // 1. Kirim via Email (Hanya jika klien memilih EMAIL atau BOTH dan mengisi email)
  if (sendEmail && params.order.customer_email) {
    try {
      await sendCustomOrderEmail({
        type: params.type,
        toEmail: params.order.customer_email,
        customerName: params.order.customer_name,
        orderCode: params.order.order_code,
        projectTitle: params.order.project_title,
        estimatedCompletion: params.order.estimated_completion,
        price: params.order.price,
        adminNote: params.order.admin_note,
        files: params.files,
      });
    } catch (e) {
      console.error('Gagal mengirim email layanan kustom ke klien:', e);
    }
  }

  // 2. Kirim via Bot Telegram @RizzFlow_Notif_bot (Jika klien memilih TELEGRAM atau BOTH)
  if (sendTg && params.order.customer_telegram_id) {
    let tgText = '';
    if (params.type === 'CREATED') {
      tgText =
        `✨ *PESANAN LAYANAN KUSTOM DITERIMA*\n\n` +
        `Halo *${params.order.customer_name}*,\n` +
        `Permintaan layanan kustom *${params.order.project_title}* telah masuk ke antrian RizzFlow.\n\n` +
        `🔑 *Kode Pesanan Kamu:* \`${params.order.order_code}\`\n\n` +
        `Simpan kode di atas! Kami akan mengirimkan update estimasi pengerjaan dan tagihan melalui bot ini. Kamu juga dapat mengeceknya di menu Layanan: ${appUrl}`;
    } else if (params.type === 'ACCEPTED_ESTIMATE') {
      tgText =
        `🛠️ *PESANAN DITERIMA & SEDANG DIPROSES*\n\n` +
        `Halo *${params.order.customer_name}*,\n` +
        `Pesanan kustom *${params.order.project_title}* (Kode: \`${params.order.order_code}\`) telah diterima Admin dan sedang dikerjakan!\n\n` +
        `⏱️ *Estimasi Selesai:* ${params.order.estimated_completion || 'Segera'}\n` +
        (params.order.price > 0
          ? `💰 *Estimasi Biaya:* Rp${params.order.price.toLocaleString('id-ID')}\n`
          : '') +
        `📝 *Pesan Admin:* ${params.order.admin_note}\n\n` +
        `Cek status kapan saja di: ${appUrl}`;
    } else if (params.type === 'BILL_READY') {
      tgText =
        `🎉 *PRODUK KUSTOM SELESAI — SILAKAN LAKUKAN PEMBAYARAN*\n\n` +
        `Halo *${params.order.customer_name}*,\n` +
        `Pesanan kustom *${params.order.project_title}* (Kode: \`${params.order.order_code}\`) telah *SELESAI* dikerjakan!\n\n` +
        `💵 *Total Tagihan:* *Rp${params.order.price.toLocaleString('id-ID')}*\n` +
        `📝 *Catatan Admin:* ${params.order.admin_note}\n\n` +
        `Silakan buka menu *Layanan* di ${appUrl}, masukkan kode \`${params.order.order_code}\`, dan bayar via QRIS untuk langsung mengunduh produkmu!`;
    } else {
      const fileLines = (params.files || [])
        .map((f, i) => `${i + 1}. ${f.productTitle}:\n${f.signedDownloadUrl}`)
        .join('\n\n');
      tgText =
        `✅ *PEMBAYARAN LUNAS — BERIKUT PRODUK KUSTOM KAMU*\n\n` +
        `Terima kasih *${params.order.customer_name}*! Pembayaran untuk pesanan \`${params.order.order_code}\` telah lunas.\n\n` +
        `📦 *Link Unduh Produk Kamu:*\n${fileLines || 'Silakan unduh langsung di halaman Layanan website RizzFlow.'}`;
    }

    await sendClientTelegramNotification(
      params.order.customer_telegram_id,
      tgText
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicConfig = searchParams.get('config') === '1';
    const orderCodeParam = (searchParams.get('order_code') || '')
      .trim()
      .toUpperCase();

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

      let unlockedFiles: PurchasedFileLink[] = [];

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
      action?:
        | 'SEND_MESSAGE'
        | 'GENERATE_CUSTOM_QRIS'
        | 'CONFIRM_CUSTOM_PAYMENT';
      type?: 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';
      notify_channel?: CustomNotificationChannel;
      sender_name?: string;
      sender_email?: string;
      sender_contact?: string;
      customer_telegram_id?: string;
      invoice_number?: string;
      project_title?: string;
      message?: string;
      order_code?: string;
    };

    const action = body.action || 'SEND_MESSAGE';

    // A. KLIEN MEMBUKA QRIS UNTUK MEMBAYAR TAGIHAN LAYANAN KUSTOM
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
        customerEmail: target.customer_email || 'telegram-user@rizzflow.store',
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
      const updatedTarget = updatedOrders.find((o) => o.order_code === code)!;

      // Notifikasi Telegram ke Admin bahwa klien sedang membuka QRIS pembayaran kustom
      await sendAdminTelegramNotification(
        `🧾 *KLIEN MEMBUKA QRIS TAGIHAN KUSTOM*\n\n` +
          `🔑 Kode Pesanan: *${updatedTarget.order_code}*\n` +
          `✨ Proyek: ${updatedTarget.project_title}\n` +
          `👤 Klien: ${updatedTarget.customer_name}\n` +
          `💵 Tagihan: *Rp${updatedTarget.price.toLocaleString('id-ID')}*`
      );

      return NextResponse.json({
        customOrder: updatedTarget,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    // B. KLIEN MELUNASI TAGIHAN LAYANAN KUSTOM -> KIRIM PRODUK OTOMATIS & NOTIF ADMIN
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

      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin.from('orders').insert({
        invoice_number:
          paidTarget.invoice_number ||
          `INV-${paidTarget.order_code}-${Date.now()}`,
        customer_email:
          paidTarget.customer_email ||
          `telegram-${paidTarget.customer_telegram_id || paidTarget.order_code}`,
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

      await dispatchClientCustomNotification({
        order: paidTarget,
        type: 'PAID_DELIVERY',
        files: unlockedFiles,
      });

      await sendAdminTelegramNotification(
        `💰 *TRANSAKSI LAYANAN KUSTOM BERHASIL LUNAS!*\n\n` +
          `🔑 Kode Pesanan: *${paidTarget.order_code}*\n` +
          `✨ Proyek: ${paidTarget.project_title}\n` +
          `👤 Klien: ${paidTarget.customer_name}\n` +
          `💵 Nominal Lunas: *Rp${paidTarget.price.toLocaleString('id-ID')}*\n\n` +
          `File produk kustom telah otomatis dikirim ke klien!`
      );

      return NextResponse.json({
        customOrder: paidTarget,
        unlockedFiles,
      });
    }

    // C. KLIEN MENGIRIM PESAN / MEMESAN LAYANAN KUSTOM BARU
    const senderName = (body.sender_name || '').trim();
    const senderEmail = (body.sender_email || '').trim().toLowerCase();
    const senderContact = (body.sender_contact || '').trim();
    const customerTelegramId = (body.customer_telegram_id || '').trim();
    const notifyChannel: CustomNotificationChannel =
      body.notify_channel || 'EMAIL';
    const invoiceNumber = (body.invoice_number || '').trim();
    const projectTitle =
      (body.project_title || '').trim() || 'Pesanan Layanan Digital Kustom';
    const messageText = (body.message || '').trim();
    const msgType = body.type || 'LAYANAN_KHUSUS';

    if (!senderName || !messageText) {
      return NextResponse.json(
        { error: 'Nama dan rincian pesan wajib diisi.' },
        { status: 400 }
      );
    }

    // Validasi sesuai saluran notifikasi yang dipilih klien
    if (msgType === 'LAYANAN_KHUSUS') {
      if (
        (notifyChannel === 'EMAIL' || notifyChannel === 'BOTH') &&
        (!senderEmail || !senderEmail.includes('@'))
      ) {
        return NextResponse.json(
          {
            error:
              'Mohon isi alamat email aktif kamu untuk menerima kode pesanan via Email.',
          },
          { status: 400 }
        );
      }
      if (
        (notifyChannel === 'TELEGRAM' || notifyChannel === 'BOTH') &&
        !customerTelegramId
      ) {
        return NextResponse.json(
          {
            error:
              'Mohon isi ID Telegram (Chat ID) kamu untuk menerima notifikasi dari Bot Telegram.',
          },
          { status: 400 }
        );
      }
    } else if (!senderEmail || !senderEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Alamat email aktif wajib diisi.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let createdCustomOrder: CustomProjectOrder | null = null;

    if (msgType === 'LAYANAN_KHUSUS') {
      const existingOrders = await getStoredCustomProjectOrders();
      const orderCode = generateCustomOrderCode(existingOrders);

      createdCustomOrder = {
        id: crypto.randomUUID(),
        order_code: orderCode,
        customer_name: senderName,
        customer_email:
          notifyChannel === 'TELEGRAM' ? '' : senderEmail,
        customer_contact: senderContact,
        customer_telegram_id: customerTelegramId,
        notify_channel: notifyChannel,
        project_title: projectTitle,
        request_details: messageText,
        estimated_completion: '',
        price: 0,
        admin_note:
          'Permintaan layanan kustom kamu telah masuk ke antrian dan sedang ditinjau oleh Admin RizzFlow.',
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

      await dispatchClientCustomNotification({
        order: createdCustomOrder,
        type: 'CREATED',
      });
    }

    const existingMessages = await getStoredCustomerMessages();
    const newMsg: CustomerSupportMessage = {
      id: crypto.randomUUID(),
      type: msgType,
      sender_name: senderName,
      sender_email:
        senderEmail ||
        (customerTelegramId ? `Telegram ID: ${customerTelegramId}` : '-'),
      sender_contact: senderContact,
      invoice_number: createdCustomOrder
        ? createdCustomOrder.order_code
        : invoiceNumber,
      message: messageText,
      status: 'BARU',
      created_at: nowIso,
    };

    await saveStoredCustomerMessages([newMsg, ...existingMessages]);

    const typeLabel =
      msgType === 'LAYANAN_KHUSUS'
        ? `✨ *PESANAN LAYANAN KUSTOM BARU (${createdCustomOrder?.order_code})*`
        : msgType === 'KLAIM_GARANSI'
        ? `🛡️ *KLAIM GARANSI BARU*`
        : `💬 *PERTANYAAN KLIEN BARU*`;

    await sendAdminTelegramNotification(
      `${typeLabel}\n\n` +
        `👤 Nama: *${senderName}*\n` +
        `🔔 Saluran Notif: *${notifyChannel}*\n` +
        `📧 Email: ${senderEmail || '-'}\n` +
        `🤖 ID Telegram: ${customerTelegramId || '-'}\n` +
        `📱 WA: ${senderContact || '-'}\n` +
        (createdCustomOrder
          ? `🔑 Kode Pesanan: *${createdCustomOrder.order_code}*\n🎯 Layanan: ${projectTitle}\n`
          : invoiceNumber
          ? `🧾 Invoice: #${invoiceNumber}\n`
          : '') +
        `\n📝 *Rincian Pesan:*\n${messageText}`
    );

    return NextResponse.json({
      success: true,
      customOrder: createdCustomOrder,
      message: createdCustomOrder
        ? `Pesanan Layanan Kustom berhasil dibuat dengan kode ${createdCustomOrder.order_code}! Notifikasi kode pesanan telah dikirim sesuai pilihanmu.`
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
        message: `Pengaturan disimpan & Email Tes BERHASIL dikirim dari ${testRes.senderEmail} ke ${testRes.recipientEmail}! Silakan cek kotak masuk emailmu.`,
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

export async function PATCH(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      target_type?: 'MESSAGE' | 'CUSTOM_ORDER';
      step_action?: 'ACCEPT_ESTIMATE' | 'SEND_BILL' | 'COMPLETE_CLOSE';
      id?: string;
      status?: string;
      estimated_completion?: string;
      price?: number;
      admin_note?: string;
      file_paths?: string[];
      delivery_links?: string[];
    };

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
        (body.status as CustomProjectOrder['status']) || target.status;
      const nextEstimate =
        body.estimated_completion !== undefined
          ? body.estimated_completion.trim()
          : target.estimated_completion || '';
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

      const updatedOrderItem: CustomProjectOrder = {
        ...target,
        status: nextStatus,
        estimated_completion: nextEstimate,
        price: nextPrice,
        admin_note: nextNote,
        file_paths: nextFiles,
        delivery_links: nextLinks,
        updated_at: new Date().toISOString(),
      };

      const updatedOrders = allOrders.map((o) =>
        o.id === body.id ? updatedOrderItem : o
      );

      await saveStoredCustomProjectOrders(updatedOrders);

      // Kirim pemberitahuan ke Klien sesuai tahapan alur Admin
      if (body.step_action === 'ACCEPT_ESTIMATE' || nextStatus === 'DIPROSES') {
        await dispatchClientCustomNotification({
          order: updatedOrderItem,
          type: 'ACCEPTED_ESTIMATE',
        });
      } else if (
        body.step_action === 'SEND_BILL' ||
        nextStatus === 'SIAP_DIBAYAR'
      ) {
        await dispatchClientCustomNotification({
          order: updatedOrderItem,
          type: 'BILL_READY',
        });
      }

      return NextResponse.json({
        success: true,
        customOrders: updatedOrders,
        message:
          body.step_action === 'ACCEPT_ESTIMATE'
            ? `Pesanan ${target.order_code} diterima & info estimasi pengerjaan telah dikirim ke klien!`
            : body.step_action === 'SEND_BILL'
            ? `Produk ${target.order_code} siap & pemberitahuan tagihan telah dikirim ke klien!`
            : `Status pesanan ${target.order_code} berhasil diperbarui!`,
      });
    }

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