import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

async function verifyAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data?.user);
}

export async function POST(request: Request) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: 'CLOSE_AND_DELETE';
      order_ids?: string[];
    };

    const orderIds = Array.isArray(body.order_ids)
      ? body.order_ids.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0
        )
      : [];

    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada pesanan yang dipilih untuk dihapus.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Hanya izinkan penutupan & penghapusan pada pesanan yang BELUM LUNAS (bukan PAID)
    const { data: targetOrders, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('id, invoice_number, payment_status')
      .in('id', orderIds)
      .neq('payment_status', 'PAID');

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    const validIds = (targetOrders || []).map((o) => o.id as string);
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: 'Pesanan tertunda tidak ditemukan atau sudah berstatus Lunas.' },
        { status: 404 }
      );
    }

    // 1. Hapus item turunan di tabel order_items terlebih dahulu agar tidak kena error relasi
    await supabaseAdmin.from('order_items').delete().in('order_id', validIds);

    // 2. Hapus pesanan tertunda dari tabel orders
    const { error: deleteErr } = await supabaseAdmin
      .from('orders')
      .delete()
      .in('id', validIds);

    if (deleteErr) {
      throw new Error(deleteErr.message);
    }

    return NextResponse.json({
      success: true,
      deletedIds: validIds,
      message:
        validIds.length === 1
          ? 'Pesanan tertunda berhasil ditutup & dihapus.'
          : `${validIds.length} pesanan tertunda berhasil ditutup & dihapus.`,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Gagal menutup & menghapus pesanan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}