import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSupabaseAdmin,
  getStoredSubscriptionOrders,
  saveStoredSubscriptionOrders,
  SubscriptionOrder,
  SubscriptionOrderStatus,
  parseThumbnails,
} from '@/lib/supabase';
import { createDokuQrisPayment } from '@/lib/doku';
import { sendSubscriptionStatusEmail } from '@/lib/email';
import { Product } from '@/types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function verifyAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data?.user);
}

async function processAutoExpireTwoHours(
  orders: SubscriptionOrder[]
): Promise<SubscriptionOrder[]> {
  const now = Date.now();
  let changed = false;
  const updatedOrders: SubscriptionOrder[] = [];

  for (const ord of orders) {
    if (
      ord.status === 'MENUNGGU_ADMIN' &&
      now > new Date(ord.expires_wait_at).getTime()
    ) {
      changed = true;
      const expiredOrder: SubscriptionOrder = {
        ...ord,
        status: 'DIBATALKAN',
        admin_note:
          'Dibatalkan otomatis oleh sistem karena batas waktu tunggu konfirmasi Admin (2 jam) telah berakhir.',
        updated_at: new Date().toISOString(),
      };
      updatedOrders.push(expiredOrder);

      try {
        await sendSubscriptionStatusEmail({
          toEmail: expiredOrder.customer_email,
          customerName: expiredOrder.customer_name,
          code: expiredOrder.code,
          productTitle: expiredOrder.product_title,
          status: 'DIBATALKAN',
          adminNote: expiredOrder.admin_note,
        });
      } catch (e) {
        console.error('Gagal mengirim email auto-cancel 2 jam:', e);
      }
    } else {
      updatedOrders.push(ord);
    }
  }

  if (changed) {
    await saveStoredSubscriptionOrders(updatedOrders);
  }

  return updatedOrders;
}

function generateUnique4DigitCode(existing: SubscriptionOrder[]): string {
  const usedCodes = new Set<string>(existing.map((o) => o.code));
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = (searchParams.get('code') || '').trim();

    let allOrders = await getStoredSubscriptionOrders();
    allOrders = await processAutoExpireTwoHours(allOrders);

    if (codeParam) {
      const found = allOrders.find((o) => o.code === codeParam);
      if (!found) {
        return NextResponse.json(
          { error: `Kode Pre-Order / Antrian "${codeParam}" tidak ditemukan.` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        subscription: found,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    return NextResponse.json({ subscriptions: allOrders });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memuat data langganan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: 'CREATE_PREORDER' | 'GENERATE_QRIS' | 'CONFIRM_PAYMENT';
      product_id?: string;
      customer_name?: string;
      customer_email?: string;
      customer_contact?: string;
      code?: string;
    };

    const action = body.action || 'CREATE_PREORDER';
    let allOrders = await getStoredSubscriptionOrders();
    allOrders = await processAutoExpireTwoHours(allOrders);

    if (action === 'CREATE_PREORDER') {
      const email = (body.customer_email || '').trim().toLowerCase();
      const name = (body.customer_name || '').trim() || 'Pelanggan RizzFlow';
      const contact = (body.customer_contact || '').trim();
      const productId = (body.product_id || '').trim();

      if (!email || !productId) {
        return NextResponse.json(
          { error: 'Alamat email wajib diisi untuk mengambil kode antrian.' },
          { status: 400 }
        );
      }

      const supabaseAdmin = getSupabaseAdmin();
      const { data: prodData, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (prodErr || !prodData) {
        return NextResponse.json(
          { error: 'Produk langganan tidak ditemukan.' },
          { status: 404 }
        );
      }

      const product = prodData as Product;
      const code4Digit = generateUnique4DigitCode(allOrders);
      const nowIso = new Date().toISOString();
      const expiresWaitIso = new Date(Date.now() + TWO_HOURS_MS).toISOString();
      const coverThumb =
        parseThumbnails(product.thumbnail_url)[0] || product.thumbnail_url;

      const newSubOrder: SubscriptionOrder = {
        id: crypto.randomUUID(),
        code: code4Digit,
        product_id: product.id,
        product_title: product.title,
        product_price: product.price,
        product_thumbnail: coverThumb,
        customer_name: name,
        customer_email: email,
        customer_contact: contact,
        status: 'MENUNGGU_ADMIN',
        admin_note:
          'Sedang menunggu konfirmasi ketersediaan stok dari Admin (Batas respon maksimal 2 jam).',
        delivered_account: '',
        qris_string: null,
        invoice_number: null,
        payment_status: 'UNPAID',
        created_at: nowIso,
        expires_wait_at: expiresWaitIso,
        updated_at: nowIso,
      };

      const updated = [newSubOrder, ...allOrders];
      await saveStoredSubscriptionOrders(updated);

      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      const tgChatId = process.env.TELEGRAM_CHAT_ID;
      if (tgToken && tgChatId) {
        try {
          await fetch(`[https://api.telegram.org/bot$](https://api.telegram.org/bot$){tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgChatId,
              text:
                `🔔 *ANTRIAN LANGGANAN BARU (KODE: ${code4Digit})*\n\n` +
                `📦 Produk: *${product.title}*\n` +
                `👤 Pelanggan: ${name}\n` +
                `📧 Email: ${email}\n` +
                `📱 WA: ${contact || '-'}\n\n` +
                `Segera buka halaman Admin RizzFlow (Tab Layanan Langganan) dalam waktu maksimal 2 jam!`,
              parse_mode: 'Markdown',
            }),
          });
        } catch {
          // Abaikan jika gagal
        }
      }

      return NextResponse.json({
        success: true,
        subscription: newSubOrder,
      });
    }

    if (action === 'GENERATE_QRIS') {
      const code = (body.code || '').trim();
      const target = allOrders.find((o) => o.code === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (target.status !== 'STOK_TERSEDIA') {
        return NextResponse.json(
          {
            error:
              'Pembayaran belum dapat dilakukan karena stok belum dikonfirmasi Admin.',
          },
          { status: 400 }
        );
      }

      const invoiceNumber = `SUB-${target.code}-${Math.floor(100 + Math.random() * 900)}`;
      const dokuQris = await createDokuQrisPayment({
        invoiceNumber,
        amount: target.product_price,
        customerEmail: target.customer_email,
      });

      const updatedOrders = allOrders.map((o) =>
        o.code === code
          ? {
              ...o,
              qris_string: dokuQris.qris_string,
              invoice_number: invoiceNumber,
              payment_status: 'PENDING' as const,
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredSubscriptionOrders(updatedOrders);
      const updatedTarget = updatedOrders.find((o) => o.code === code);

      return NextResponse.json({
        success: true,
        subscription: updatedTarget,
        simulation_mode: process.env.DOKU_SIMULATION_MODE === 'true',
      });
    }

    if (action === 'CONFIRM_PAYMENT') {
      const code = (body.code || '').trim();
      const target = allOrders.find((o) => o.code === code);

      if (!target) {
        return NextResponse.json(
          { error: 'Kode tidak ditemukan.' },
          { status: 404 }
        );
      }

      const updatedOrders = allOrders.map((o) =>
        o.code === code
          ? {
              ...o,
              status: 'DIPROSES' as const,
              payment_status: 'PAID' as const,
              admin_note:
                'Pembayaran telah diterima! Pesanan sedang diproses oleh Admin dan sudah tidak dapat dibatalkan.',
              updated_at: new Date().toISOString(),
            }
          : o
      );

      await saveStoredSubscriptionOrders(updatedOrders);
      const updatedTarget = updatedOrders.find((o) => o.code === code)!;

      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin.from('orders').insert({
        invoice_number:
          updatedTarget.invoice_number ||
          `SUB-${updatedTarget.code}-${Date.now()}`,
        customer_email: updatedTarget.customer_email,
        subtotal_amount: updatedTarget.product_price,
        discount_amount: 0,
        final_amount: updatedTarget.product_price,
        payment_status: 'PAID',
        qris_string: updatedTarget.qris_string,
        qris_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        paid_at: new Date().toISOString(),
      });

      await sendSubscriptionStatusEmail({
        toEmail: updatedTarget.customer_email,
        customerName: updatedTarget.customer_name,
        code: updatedTarget.code,
        productTitle: updatedTarget.product_title,
        status: 'DIPROSES',
        adminNote: updatedTarget.admin_note,
      });

      return NextResponse.json({
        success: true,
        subscription: updatedTarget,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Gagal memproses pesanan langganan.';
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
      id?: string;
      status?: SubscriptionOrderStatus;
      admin_note?: string;
      delivered_account?: string;
    };

    const allOrders = await getStoredSubscriptionOrders();
    const target = allOrders.find((o) => o.id === body.id);

    if (!target) {
      return NextResponse.json(
        { error: 'Data antrian tidak ditemukan.' },
        { status: 404 }
      );
    }

    const nextStatus = body.status || target.status;
    const nextNote =
      body.admin_note !== undefined
        ? body.admin_note.trim()
        : target.admin_note;
    const nextDelivered =
      body.delivered_account !== undefined
        ? body.delivered_account.trim()
        : target.delivered_account;

    const updatedOrders = allOrders.map((o) =>
      o.id === body.id
        ? {
            ...o,
            status: nextStatus,
            admin_note: nextNote,
            delivered_account: nextDelivered,
            updated_at: new Date().toISOString(),
          }
        : o
    );

    await saveStoredSubscriptionOrders(updatedOrders);

    if (
      nextStatus === 'STOK_TERSEDIA' ||
      nextStatus === 'DIPROSES' ||
      nextStatus === 'DIBATALKAN'
    ) {
      try {
        await sendSubscriptionStatusEmail({
          toEmail: target.customer_email,
          customerName: target.customer_name,
          code: target.code,
          productTitle: target.product_title,
          status: nextStatus,
          adminNote: nextNote,
          deliveredAccount: nextDelivered || undefined,
        });
      } catch (e) {
        console.error('Gagal mengirim email update status langganan:', e);
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: updatedOrders,
      message: `Status kode ${target.code} diperbarui menjadi ${nextStatus} & email telah dikirim ke pelanggan!`,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal memperbarui status.';
    return NextResponse.json({ error: msg }, { status: 500 });
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

    const allOrders = await getStoredSubscriptionOrders();
    const updated = allOrders.filter((o) => o.id !== id);
    await saveStoredSubscriptionOrders(updated);

    return NextResponse.json({ success: true, subscriptions: updated });
  } catch {
    return NextResponse.json(
      { error: 'Gagal menghapus antrian.' },
      { status: 500 }
    );
  }
}