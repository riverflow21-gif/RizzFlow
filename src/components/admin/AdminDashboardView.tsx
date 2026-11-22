'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Clock,
  Package,
  Sparkles,
  Inbox,
  RefreshCw,
  CheckCircle2,
  ArrowUpRight,
  Copy,
  Check,
  Trash2,
  Loader2,
  BarChart3,
  BellRing,
  Wallet,
  Calendar,
  XCircle,
} from 'lucide-react';
import {
  supabase,
  CustomProjectOrder,
  CustomerSupportMessage,
} from '@/lib/supabase';
import { Order, Product, Category } from '@/types';
import { AdminTab } from './AdminTypes';

interface AdminDashboardViewProps {
  accessToken: string;
  onNavigateTab: (tab: AdminTab) => void;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
}

type OrderFilterType = 'ALL' | 'PAID' | 'PENDING';

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatRpFull(amount: number): string {
  return `Rp${Math.max(0, Math.round(amount)).toLocaleString('id-ID')}`;
}

/**
 * Mengubah waktu ISO ke kunci WIB (UTC+7): YYYY-MM dan YYYY-MM-DD
 */
function getWibParts(isoString: string): { yearMonth: string; dateKey: string } {
  try {
    const rawMs = new Date(isoString).getTime();
    if (Number.isNaN(rawMs)) {
      return getCurrentWibParts();
    }
    const wib = new Date(rawMs + 7 * 60 * 60 * 1000);
    const iso = wib.toISOString();
    return {
      yearMonth: iso.slice(0, 7),
      dateKey: iso.slice(0, 10),
    };
  } catch {
    return getCurrentWibParts();
  }
}

function getCurrentWibParts(): { yearMonth: string; dateKey: string } {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const iso = wib.toISOString();
  return {
    yearMonth: iso.slice(0, 7),
    dateKey: iso.slice(0, 10),
  };
}

function formatMonthLabel(yearMonth: string): string {
  const parts = yearMonth.split('-');
  if (parts.length !== 2) return yearMonth;
  const year = parts[0];
  const monthIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
  return `${INDONESIAN_MONTHS[monthIdx]} ${year}`;
}

function formatDateWib(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AdminDashboardView({
  accessToken,
  onNavigateTab,
  onShowFeedback,
}: AdminDashboardViewProps) {
  const currentWib = getCurrentWibParts();

  const [orders, setOrders] = useState([] as Order[]);
  const [products, setProducts] = useState([] as Product[]);
  const [categories, setCategories] = useState([] as Category[]);
  const [customOrders, setCustomOrders] = useState([] as CustomProjectOrder[]);
  const [messages, setMessages] = useState([] as CustomerSupportMessage[]);

  // Periode default selalu Bulan Ini (otomatis reset dari 0 saat ganti bulan)
  // Bisa diubah ke bulan lain ("YYYY-MM") atau "ALL" (Total Keseluruhan)
  const [selectedPeriod, setSelectedPeriod] = useState(currentWib.yearMonth);
  const [showPeriodControls, setShowPeriodControls] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderFilter, setOrderFilter] = useState('ALL' as OrderFilterType);
  const [copiedId, setCopiedId] = useState(null as string | null);
  const [deletingOrderId, setDeletingOrderId] = useState(null as string | null);
  const [confirmClearAllPending, setConfirmClearAllPending] = useState(false);
  const [isClearingAllPending, setIsClearingAllPending] = useState(false);
  const [notifStatus, setNotifStatus] = useState('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission);
    }
  }, []);

  const loadDashboardData = useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [ordRes, prodRes, catRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase.from('products').select('*'),
          supabase.from('categories').select('*'),
        ]);

        if (ordRes.data) setOrders(ordRes.data as Order[]);
        if (prodRes.data) setProducts(prodRes.data as Product[]);
        if (catRes.data) setCategories(catRes.data as Category[]);

        if (accessToken) {
          const msgRes = await fetch('/api/messages', {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (msgRes.ok) {
            const msgData = (await msgRes.json()) as {
              customOrders?: CustomProjectOrder[];
              messages?: CustomerSupportMessage[];
            };
            if (Array.isArray(msgData.customOrders)) {
              setCustomOrders(msgData.customOrders);
            }
            if (Array.isArray(msgData.messages)) {
              setMessages(msgData.messages);
            }
          }
        }
      } catch (e) {
        console.error('Gagal memuat dashboard:', e);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    loadDashboardData(false);
  }, [loadDashboardData]);

  const handleEnableAlarm = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onShowFeedback('error', 'Browser ini tidak mendukung notifikasi alarm.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      onShowFeedback('success', 'Alarm notifikasi HP berhasil diaktifkan!');
    } else {
      onShowFeedback('error', 'Izin notifikasi ditolak di pengaturan browser.');
    }
  };

  const handleCopyEmail = (email: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  /**
   * Menutup & menghapus 1 pesanan tertunda (via Server API Service Role)
   */
  const handleCloseAndDeleteOrder = async (order: Order) => {
    setDeletingOrderId(order.id);
    try {
      const res = await fetch('/api/orders/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'CLOSE_AND_DELETE',
          order_ids: [order.id],
        }),
      });

      const data = (await res.json()) as {
        deletedIds?: string[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menutup & menghapus pesanan.');
      }

      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      onShowFeedback(
        'success',
        `Pesanan tertunda #${order.invoice_number} ditutup & dihapus.`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menghapus pesanan.'
      );
    } finally {
      setDeletingOrderId(null);
    }
  };

  /**
   * Menutup & menghapus seluruh pesanan tertunda pada periode yang sedang dilihat
   */
  const handleCloseAndDeleteAllPending = async (targetPending: Order[]) => {
    if (targetPending.length === 0) return;
    setIsClearingAllPending(true);
    try {
      const ids = targetPending.map((o) => o.id);
      const res = await fetch('/api/orders/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'CLOSE_AND_DELETE',
          order_ids: ids,
        }),
      });

      const data = (await res.json()) as {
        deletedIds?: string[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menutup pesanan tertunda.');
      }

      const deletedSet = new Set(data.deletedIds || ids);
      setOrders((prev) => prev.filter((o) => !deletedSet.has(o.id)));
      setConfirmClearAllPending(false);
      onShowFeedback(
        'success',
        data.message || `${ids.length} pesanan tertunda ditutup & dihapus.`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menghapus pesanan tertunda.'
      );
    } finally {
      setIsClearingAllPending(false);
    }
  };

  // ==========================================================================
  // DAFTAR BULAN TERSEDIA & FILTER PERIODE (BULANAN OTOMATIS RESET vs KESELURUHAN)
  // ==========================================================================
  const monthSet = new Set<string>([currentWib.yearMonth]);
  for (const ord of orders) {
    const refIso = ord.paid_at || ord.created_at;
    if (refIso) {
      monthSet.add(getWibParts(refIso).yearMonth);
    }
  }
  const availableMonths = Array.from(monthSet).sort((a, b) =>
    b.localeCompare(a)
  );

  const isAllTime = selectedPeriod === 'ALL';
  const isCurrentMonth = selectedPeriod === currentWib.yearMonth;
  const periodDisplayTitle = isAllTime
    ? 'Total Keseluruhan (Semua Waktu)'
    : isCurrentMonth
    ? `${formatMonthLabel(selectedPeriod)} (Bulan Ini)`
    : formatMonthLabel(selectedPeriod);

  // Filter pesanan berdasarkan periode yang dipilih (Default = Bulan Ini -> reset ke 0 saat ganti bulan)
  const periodOrders = isAllTime
    ? orders
    : orders.filter((o) => {
        const refIso =
          o.payment_status === 'PAID'
            ? o.paid_at || o.created_at
            : o.created_at;
        return getWibParts(refIso).yearMonth === selectedPeriod;
      });

  const periodPaidOrders = periodOrders.filter(
    (o) => o.payment_status === 'PAID'
  );
  const periodPendingOrders = periodOrders.filter(
    (o) => o.payment_status !== 'PAID'
  );

  const periodRevenue = periodPaidOrders.reduce(
    (sum, o) => sum + (Number(o.final_amount) || 0),
    0
  );
  const periodPendingNominal = periodPendingOrders.reduce(
    (sum, o) => sum + (Number(o.final_amount) || 0),
    0
  );

  // Total Keseluruhan (selalu dihitung sebagai referensi cepat)
  const allTimePaidOrders = orders.filter((o) => o.payment_status === 'PAID');
  const allTimeRevenue = allTimePaidOrders.reduce(
    (sum, o) => sum + (Number(o.final_amount) || 0),
    0
  );

  // Pemasukan Hari Ini (WIB)
  const todayPaidOrders = allTimePaidOrders.filter(
    (o) => getWibParts(o.paid_at || o.created_at).dateKey === currentWib.dateKey
  );
  const todayRevenue = todayPaidOrders.reduce(
    (sum, o) => sum + (Number(o.final_amount) || 0),
    0
  );

  const activeProductsCount = products.filter((p) => p.is_active).length;
  const activeCustomBillsCount = customOrders.filter(
    (c) => c.status !== 'LUNAS' && c.status !== 'DIBATALKAN'
  ).length;
  const paidCustomBillsCount = customOrders.filter(
    (c) => c.status === 'LUNAS'
  ).length;
  const unreadMessagesCount = messages.filter(
    (m) => m.status === 'BARU'
  ).length;

  // Grafik Batang 7 Hari Terakhir (WIB)
  const last7Days: {
    dateKey: string;
    label: string;
    revenue: number;
    count: number;
  }[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const { dateKey } = getWibParts(dayDate.toISOString());
    const label = dayDate.toLocaleDateString('id-ID', { weekday: 'short' });
    const matching = allTimePaidOrders.filter(
      (o) => getWibParts(o.paid_at || o.created_at).dateKey === dateKey
    );
    const rev = matching.reduce(
      (sum, o) => sum + (Number(o.final_amount) || 0),
      0
    );
    last7Days.push({
      dateKey,
      label,
      revenue: rev,
      count: matching.length,
    });
  }
  const maxDayRevenue = Math.max(1, ...last7Days.map((d) => d.revenue));

  const filteredOrders = periodOrders.filter((o) => {
    if (orderFilter === 'PAID') return o.payment_status === 'PAID';
    if (orderFilter === 'PENDING') return o.payment_status !== 'PAID';
    return true;
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#375534]">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-xs font-bold">Memuat ringkasan dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ==================================================================== */}
      {/* 1. KARTU PENDAPATAN UTAMA FULL-WIDTH + PENGATURAN PERIODE BULANAN */}
      {/* ==================================================================== */}
      <section className="rounded-[30px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-7 border border-[#375534] shadow-lg relative overflow-hidden space-y-5">
        <div className="w-60 h-60 rounded-full bg-[#375534]/45 blur-3xl absolute -top-20 -right-12 pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#375534]/85 text-[#E3EED4] text-[11px] font-extrabold tracking-wide">
            <Wallet className="w-3.5 h-3.5" />
            <span>{periodDisplayTitle.toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-2">
            {notifStatus !== 'granted' && (
              <button
                type="button"
                onClick={handleEnableAlarm}
                className="px-3 py-1.5 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] text-[11px] font-extrabold inline-flex items-center gap-1"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Alarm HP</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPeriodControls((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] text-[11px] font-extrabold inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Atur Periode</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => loadDashboardData(true)}
              className="px-3 py-1.5 rounded-full bg-[#375534]/75 hover:bg-[#375534] text-[#E3EED4] border border-[#6B9071]/40 text-[11px] font-extrabold inline-flex items-center gap-1.5"
            >
              <RefreshCw
                className={
                  isRefreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'
                }
              />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Panel Penglihatan Lebih Lanjut (Pilih Bulan Tertentu atau Total Keseluruhan) */}
        {showPeriodControls && (
          <div className="relative z-10 p-4 rounded-2xl bg-[#375534]/75 border border-[#AEC3B0]/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-white">
                  Penglihatan Lebih Lanjut — Filter Periode Laporan
                </p>
                <p className="text-[11px] text-[#AEC3B0]">
                  Default dashboard dihitung per bulan (otomatis mulai dari Rp0 tiap ganti bulan).
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(currentWib.yearMonth)}
                  className={
                    isCurrentMonth
                      ? 'px-3 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-[11px] font-extrabold'
                      : 'px-3 py-1.5 rounded-full bg-[#0F2A1D]/60 text-[#E3EED4] text-[11px] font-bold'
                  }
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('ALL')}
                  className={
                    isAllTime
                      ? 'px-3 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-[11px] font-extrabold'
                      : 'px-3 py-1.5 rounded-full bg-[#0F2A1D]/60 text-[#E3EED4] text-[11px] font-bold'
                  }
                >
                  Total Keseluruhan
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-[11px] font-bold text-[#E3EED4] shrink-0">
                Pilih Riwayat Bulan:
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0F2A1D] border border-[#6B9071] text-xs font-extrabold text-white focus:outline-none focus:border-[#E3EED4]"
              >
                <option value="ALL">
                  📊 Total Keseluruhan (Semua Waktu — {allTimePaidOrders.length}{' '}
                  Transaksi Lunas)
                </option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    📅 {formatMonthLabel(ym)}
                    {ym === currentWib.yearMonth ? ' (Bulan Ini)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Nominal Pendapatan Periode Aktif — Tampil 100% Utuh */}
        <div className="relative z-10 space-y-1">
          <span className="block text-xs font-bold text-[#AEC3B0]">
            {isAllTime
              ? 'Total Pendapatan Lunas Keseluruhan'
              : `Pendapatan Lunas — ${formatMonthLabel(selectedPeriod)}`}
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight break-words leading-tight">
            {formatRpFull(periodRevenue)}
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E3EED4]/90 pt-1">
            <CheckCircle2 className="w-4 h-4 text-[#AEC3B0] shrink-0" />
            <span>
              {periodPaidOrders.length} transaksi lunas pada periode ini
            </span>
          </div>
        </div>

        {/* Baris 2 Kolom: Pendapatan Hari Ini & Total Keseluruhan (Pintasan 1 Klik) */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-4 rounded-2xl bg-[#375534]/55 border border-[#6B9071]/40">
            <span className="block text-[11px] font-bold text-[#AEC3B0]">
              Pendapatan Hari Ini (WIB)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-0.5 break-words">
              {formatRpFull(todayRevenue)}
            </div>
            <span className="block text-[11px] text-[#E3EED4]/80 mt-0.5">
              {todayPaidOrders.length} transaksi masuk hari ini
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedPeriod(isAllTime ? currentWib.yearMonth : 'ALL')
            }
            className="p-4 rounded-2xl bg-[#375534]/55 hover:bg-[#375534]/85 border border-[#6B9071]/40 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="block text-[11px] font-bold text-[#AEC3B0]">
                {isAllTime
                  ? 'Kembali ke Bulan Ini'
                  : 'Total Keseluruhan (Semua Waktu)'}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#E3EED4] shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-0.5 break-words">
              {formatRpFull(allTimeRevenue)}
            </div>
            <span className="block text-[11px] text-[#E3EED4]/80 mt-0.5">
              {allTimePaidOrders.length} transaksi lunas • Ketuk untuk beralih
            </span>
          </button>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. 4 KARTU RINGKASAN OPERASIONAL */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-3xl bg-white border border-[#AEC3B0]/65 rf-card-shadow flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#375534]">
              Pesanan Tertunda (Belum Bayar)
            </span>
            <span className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F2A1D]">
              {periodPendingOrders.length} Pesanan
            </div>
            <p className="text-xs font-bold text-[#6B9071] mt-0.5 break-words">
              Nominal: {formatRpFull(periodPendingNominal)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('catalog')}
          className="p-5 rounded-3xl bg-white hover:bg-[#F6F8F3] border border-[#AEC3B0]/65 rf-card-shadow text-left flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold text-[#375534]">
              Katalog Produk
            </span>
            <span className="w-9 h-9 rounded-2xl bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F2A1D]">
              {activeProductsCount} Aktif
            </div>
            <p className="text-xs font-bold text-[#375534] mt-0.5 inline-flex items-center gap-1">
              <span>
                Total {products.length} produk • {categories.length} kategori
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('services')}
          className="p-5 rounded-3xl bg-[#E3EED4]/75 hover:bg-[#E3EED4] border border-[#6B9071]/60 rf-card-shadow text-left flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold text-[#0F2A1D]">
              Transaksi Kustom
            </span>
            <span className="w-9 h-9 rounded-2xl bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F2A1D]">
              {activeCustomBillsCount} Tagihan Aktif
            </div>
            <p className="text-xs font-bold text-[#375534] mt-0.5 inline-flex items-center gap-1">
              <span>{paidCustomBillsCount} proyek lunas • Buat/Kelola</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('services')}
          className="p-5 rounded-3xl bg-white hover:bg-[#F6F8F3] border border-[#AEC3B0]/65 rf-card-shadow text-left flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold text-[#375534]">
              Garansi &amp; Pesan
            </span>
            <span className="w-9 h-9 rounded-2xl bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F2A1D]">
              {unreadMessagesCount} Baru
            </div>
            <p className="text-xs font-bold text-[#375534] mt-0.5 inline-flex items-center gap-1">
              <span>Total {messages.length} pesan masuk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </button>
      </section>

      {/* ==================================================================== */}
      {/* 3. GRAFIK BATANG PENJUALAN 7 HARI TERAKHIR */}
      {/* ==================================================================== */}
      <section className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/65 rf-card-shadow space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#375534]" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0F2A1D]">
                Tren Pemasukan 7 Hari Terakhir
              </h2>
              <p className="text-[11px] text-[#6B9071]">
                Perbandingan transaksi lunas harian
              </p>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 text-[#375534]" />
        </div>

        <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4 px-1">
          {last7Days.map((day) => {
            const heightPercent =
              day.revenue > 0
                ? Math.max(14, Math.round((day.revenue / maxDayRevenue) * 100))
                : 6;
            const isToday = day.dateKey === currentWib.dateKey;

            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center justify-end h-full gap-1.5"
                title={`${day.label}: ${formatRpFull(day.revenue)} (${day.count} transaksi)`}
              >
                <span className="text-[10px] font-extrabold text-[#375534]">
                  {day.count > 0 ? `${day.count}x` : '-'}
                </span>
                <div className="w-full max-w-[36px] flex-1 flex items-end">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={
                      isToday
                        ? 'w-full rounded-t-xl bg-[#0F2A1D] transition-all duration-300'
                        : day.revenue > 0
                        ? 'w-full rounded-t-xl bg-[#6B9071] transition-all duration-300'
                        : 'w-full rounded-t-xl bg-[#E3EED4]'
                    }
                  />
                </div>
                <span
                  className={
                    isToday
                      ? 'text-[11px] font-extrabold text-[#0F2A1D]'
                      : 'text-[10px] font-bold text-[#6B9071]'
                  }
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. RIWAYAT TRANSAKSI PERIODE AKTIF + FITUR TUTUP & HAPUS TERTUNDA */}
      {/* ==================================================================== */}
      <section className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/65 rf-card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#0F2A1D]">
              Riwayat Transaksi — {periodDisplayTitle} ({filteredOrders.length})
            </h2>
            <p className="text-xs text-[#6B9071]">
              Pesanan tertunda yang tidak jadi dibayar dapat langsung ditutup &amp; dihapus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setConfirmClearAllPending(false);
              }}
              className="px-3.5 py-2 rounded-full bg-[#F6F8F3] border border-[#AEC3B0] text-xs font-extrabold text-[#0F2A1D]"
            >
              <option value="ALL">Semua Waktu</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym)}
                  {ym === currentWib.yearMonth ? ' (Bulan Ini)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Status + Tombol Tutup & Hapus Semua Tertunda */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex bg-[#F6F8F3] p-1 rounded-full border border-[#AEC3B0]/60">
            <button
              type="button"
              onClick={() => setOrderFilter('ALL')}
              className={
                orderFilter === 'ALL'
                  ? 'px-3.5 py-1.5 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold'
                  : 'px-3.5 py-1.5 rounded-full text-[#375534] text-xs font-bold'
              }
            >
              Semua ({periodOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter('PAID')}
              className={
                orderFilter === 'PAID'
                  ? 'px-3.5 py-1.5 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold'
                  : 'px-3.5 py-1.5 rounded-full text-[#375534] text-xs font-bold'
              }
            >
              Lunas ({periodPaidOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter('PENDING')}
              className={
                orderFilter === 'PENDING'
                  ? 'px-3.5 py-1.5 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold'
                  : 'px-3.5 py-1.5 rounded-full text-[#375534] text-xs font-bold'
              }
            >
              Tertunda ({periodPendingOrders.length})
            </button>
          </div>

          {periodPendingOrders.length > 0 && (
            <div className="flex items-center gap-2">
              {!confirmClearAllPending ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAllPending(true)}
                  className="px-3.5 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>
                    Tutup &amp; Hapus Semua Tertunda ({periodPendingOrders.length})
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                  <span className="text-[11px] font-extrabold text-red-700">
                    Yakin hapus {periodPendingOrders.length}?
                  </span>
                  <button
                    type="button"
                    disabled={isClearingAllPending}
                    onClick={() =>
                      handleCloseAndDeleteAllPending(periodPendingOrders)
                    }
                    className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold inline-flex items-center gap-1"
                  >
                    {isClearingAllPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    <span>Ya, Hapus</span>
                  </button>
                  <button
                    type="button"
                    disabled={isClearingAllPending}
                    onClick={() => setConfirmClearAllPending(false)}
                    className="px-2.5 py-1 rounded-full bg-white text-[#0F2A1D] text-[11px] font-bold border border-[#AEC3B0]"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-xs font-bold text-[#6B9071]">
            Belum ada data transaksi pada periode {periodDisplayTitle}.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.slice(0, 60).map((ord) => {
              const isPaid = ord.payment_status === 'PAID';
              return (
                <div
                  key={ord.id}
                  className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          isPaid
                            ? 'px-2.5 py-0.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] border border-[#375534] text-[10px] font-extrabold'
                            : 'px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold'
                        }
                      >
                        {isPaid ? '✅ LUNAS' : '⏳ TERTUNDA / BELUM BAYAR'}
                      </span>
                      <span className="font-extrabold text-xs text-[#0F2A1D] break-all">
                        #{ord.invoice_number}
                      </span>
                    </div>

                    <div className="text-xs text-[#375534] break-all">
                      {ord.customer_email}
                    </div>
                    <div className="text-[11px] text-[#6B9071]">
                      {formatDateWib(ord.paid_at || ord.created_at)} WIB
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#AEC3B0]/40 shrink-0">
                    <div className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                      {formatRpFull(Number(ord.final_amount) || 0)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyEmail(ord.customer_email, ord.id)
                        }
                        className="p-2 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D]"
                        title="Salin Email Pembeli"
                      >
                        {copiedId === ord.id ? (
                          <Check className="w-3.5 h-3.5 text-[#375534]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {!isPaid && (
                        <button
                          type="button"
                          disabled={deletingOrderId === ord.id}
                          onClick={() => handleCloseAndDeleteOrder(ord)}
                          className="px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-extrabold inline-flex items-center gap-1"
                          title="Tutup & Hapus Pesanan Tertunda"
                        >
                          {deletingOrderId === ord.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Menghapus...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Tutup &amp; Hapus</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}