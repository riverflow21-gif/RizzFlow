'use client';

import React, { useState } from 'react';
import {
  BellRing,
  Smartphone,
  Search,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Receipt,
} from 'lucide-react';
import { Order, Product, Category } from '@/types';
import { CustomerSupportMessage, CustomProjectOrder } from '@/lib/supabase';
import { AdminTab, ServicesSubTab } from './AdminTypes';

interface AdminDashboardTabProps {
  orders: Order[];
  products: Product[];
  categories: Category[];
  supportMessages: CustomerSupportMessage[];
  customOrders: CustomProjectOrder[];
  notifPermission: string;
  resendingOrderId: string | null;
  onEnableNotifications: () => void;
  onInstallPwa: () => void;
  onResendEmail: (orderId: string) => void;
  onSelectTab: (tab: AdminTab) => void;
  onOpenServicesSubTab: (subTab: ServicesSubTab) => void;
}

type NullableString = string | null;

export default function AdminDashboardTab({
  orders,
  products,
  categories,
  supportMessages,
  customOrders,
  notifPermission,
  resendingOrderId,
  onEnableNotifications,
  onInstallPwa,
  onResendEmail,
  onSelectTab,
  onOpenServicesSubTab,
}: AdminDashboardTabProps) {
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(
    null as NullableString
  );

  const paidOrdersList = orders.filter((o) => o.payment_status === 'PAID');
  const pendingOrdersList = orders.filter(
    (o) => o.payment_status === 'PENDING'
  );
  const totalPaidRevenue = paidOrdersList.reduce(
    (acc, o) => acc + o.final_amount,
    0
  );

  const todayIsoPrefix = new Date().toISOString().slice(0, 10);
  const todayRevenue = paidOrdersList
    .filter((o) => (o.paid_at || o.created_at).startsWith(todayIsoPrefix))
    .reduce((acc, o) => acc + o.final_amount, 0);

  const unreadMessagesCount = supportMessages.filter(
    (m) => m.status === 'BARU'
  ).length;
  const activeCustomQueuesCount = customOrders.filter(
    (o) => o.status === 'MENUNGGU_PENGERJAAN' || o.status === 'DIPROSES'
  ).length;

  const filteredOrders = orders.filter((ord) => {
    const q = orderSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      ord.invoice_number.toLowerCase().includes(q) ||
      ord.customer_email.toLowerCase().includes(q)
    );
  });

  const visibleOrders = showAllHistory
    ? filteredOrders
    : filteredOrders.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-7 border border-[#375534] shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#AEC3B0]">
            Ringkasan Eksekutif Toko
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Dashboard Pendapatan &amp; Penjualan
          </h1>
          <p className="text-xs text-[#AEC3B0]">
            Pantau arus kas masuk, pesanan produk instan, dan antrian proyek kustom secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={onEnableNotifications}
            className={
              notifPermission === 'granted'
                ? 'px-3.5 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 bg-[#375534] text-[#E3EED4] border border-[#6B9071]'
                : 'px-3.5 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 bg-[#E3EED4] text-[#0F2A1D]'
            }
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>
              {notifPermission === 'granted'
                ? 'Alarm Pesanan Aktif'
                : 'Aktifkan Alarm HP'}
            </span>
          </button>

          <button
            type="button"
            onClick={onInstallPwa}
            className="px-3.5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-[#AEC3B0]/40 text-xs font-extrabold inline-flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pasang Aplikasi Admin</span>
          </button>
        </div>
      </div>

      {/* 6 Kartu Statistik Kompleks */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
          <span className="text-xs font-bold text-[#6B9071]">
            Total Pendapatan Lunas
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5 truncate">
            Rp{totalPaidRevenue.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] font-bold text-[#375534] mt-1 block">
            ✓ {paidOrdersList.length} transaksi selesai
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
          <span className="text-xs font-bold text-[#6B9071]">
            Pendapatan Hari Ini
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#375534] mt-1.5 truncate">
            Rp{todayRevenue.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#6B9071] mt-1 block">
            Update otomatis harian
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
          <span className="text-xs font-bold text-[#6B9071]">
            Menunggu Pembayaran QRIS
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
            {pendingOrdersList.length} Pesanan
          </div>
          <span className="text-[11px] text-[#6B9071] mt-1 block">
            Belum dipindai pembeli
          </span>
        </div>

        <div
          onClick={() => onSelectTab('catalog')}
          className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow cursor-pointer hover:border-[#375534] transition-colors"
        >
          <span className="text-xs font-bold text-[#6B9071]">
            Total Produk &amp; Kategori
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
            {products.length} Produk
          </div>
          <span className="text-[11px] font-bold text-[#375534] mt-1 block">
            Dalam {categories.length} kategori →
          </span>
        </div>

        <div
          onClick={() => {
            onOpenServicesSubTab('CUSTOM_ORDERS');
            onSelectTab('services');
          }}
          className="bg-[#E3EED4]/75 p-5 rounded-3xl border border-[#6B9071]/60 rf-card-shadow cursor-pointer hover:bg-[#E3EED4] transition-colors"
        >
          <span className="text-xs font-extrabold text-[#375534]">
            Antrian Layanan Kustom
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
            {activeCustomQueuesCount} Proyek
          </div>
          <span className="text-[11px] font-bold text-[#375534] mt-1 block">
            Klik untuk kelola alur &amp; tagihan →
          </span>
        </div>

        <div
          onClick={() => {
            onOpenServicesSubTab('INBOX_MESSAGES');
            onSelectTab('services');
          }}
          className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow cursor-pointer hover:border-[#375534] transition-colors"
        >
          <span className="text-xs font-bold text-[#6B9071]">
            Klaim Garansi &amp; Pesan
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
            {unreadMessagesCount} Baru
          </div>
          <span className="text-[11px] font-bold text-[#375534] mt-1 block">
            Total {supportMessages.length} pesan masuk →
          </span>
        </div>
      </div>

      {/* RIWAYAT TRANSAKSI BISA DILIPAT & KLIK UNTUK DETAIL */}
      <div className="bg-white rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow overflow-hidden">
        <div
          onClick={() => setIsHistorySectionOpen((prev) => !prev)}
          className="p-5 sm:p-6 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F6F8F3]/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                Riwayat Pesanan Pelanggan ({orders.length})
              </h2>
              <p className="text-xs text-[#6B9071]">
                Ketuk salah satu baris invoice untuk membuka rincian lengkap pesanan
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3.5 py-2 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
          >
            <span>{isHistorySectionOpen ? 'Lipat Daftar' : 'Buka Daftar'}</span>
            {isHistorySectionOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isHistorySectionOpen && (
          <div className="px-5 pb-6 sm:px-6 border-t border-[#AEC3B0]/40 pt-4 space-y-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B9071] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Cari Nomor Invoice atau Alamat Email Pembeli..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B9071]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {filteredOrders.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#6B9071] text-center py-8">
                Belum ada riwayat pesanan yang cocok.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleOrders.map((ord) => {
                  const isExpanded = expandedOrderId === ord.id;
                  const items = ord.order_items || [];
                  const ordExtra = ord as unknown as {
                    promo_code?: string | null;
                  };
                  const promoUsedLabel = ordExtra.promo_code || 'Promo';

                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : ord.id)
                        }
                        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#E3EED4]/45 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D]">
                            #{ord.invoice_number}
                          </span>
                          <span
                            className={
                              ord.payment_status === 'PAID'
                                ? 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071]'
                                : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800'
                            }
                          >
                            {ord.payment_status}
                          </span>
                          <span className="text-xs text-[#6B9071] truncate hidden sm:inline">
                            • {ord.customer_email}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D]">
                            Rp{ord.final_amount.toLocaleString('id-ID')}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#375534]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#6B9071]" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-[#AEC3B0]/50 space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#0F2A1D]">
                            <div>
                              <span className="text-[#6B9071] block text-[11px]">
                                Email / Kontak Pembeli:
                              </span>
                              <strong className="break-all">
                                {ord.customer_email}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#6B9071] block text-[11px]">
                                Waktu Transaksi:
                              </span>
                              <strong>
                                {new Date(ord.created_at).toLocaleString(
                                  'id-ID'
                                )}
                              </strong>
                            </div>
                          </div>

                          {items.length > 0 && (
                            <div className="p-3 rounded-xl bg-[#F6F8F3] border border-[#AEC3B0]/50 space-y-1.5">
                              <span className="font-extrabold text-[11px] text-[#375534] block">
                                Rincian Item yang Dibeli:
                              </span>
                              {items.map((it, idx) => {
                                const rawItem = it as unknown as {
                                  id?: string;
                                  product_title?: string;
                                  quantity?: number;
                                  total_price?: number;
                                  unit_price?: number;
                                  price_at_purchase?: number;
                                };
                                const qty = rawItem.quantity || 1;
                                const unitPrice =
                                  rawItem.unit_price ||
                                  rawItem.price_at_purchase ||
                                  0;
                                const computedTotal =
                                  rawItem.total_price || unitPrice * qty;

                                return (
                                  <div
                                    key={rawItem.id || idx}
                                    className="flex items-center justify-between gap-2 text-[#0F2A1D]"
                                  >
                                    <span>
                                      • {rawItem.product_title || 'Produk'} (x
                                      {qty})
                                    </span>
                                    <span className="font-bold">
                                      Rp{computedTotal.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div className="text-[11px] text-[#6B9071]">
                              Subtotal: Rp
                              {ord.subtotal_amount.toLocaleString('id-ID')}
                              {ord.discount_amount > 0 &&
                                ` • Diskon (${promoUsedLabel}): -Rp${ord.discount_amount.toLocaleString('id-ID')}`}
                            </div>

                            {ord.payment_status === 'PAID' &&
                              !ord.invoice_number.startsWith('INV-KST-') && (
                                <button
                                  type="button"
                                  onClick={() => onResendEmail(ord.id)}
                                  disabled={resendingOrderId === ord.id}
                                  className="px-4 py-2 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-center shrink-0"
                                >
                                  <Send className="w-3.5 h-3.5 text-[#E3EED4]" />
                                  <span>
                                    {resendingOrderId === ord.id
                                      ? 'Mengirim...'
                                      : 'Kirim Ulang Email Produk'}
                                  </span>
                                </button>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredOrders.length > 6 && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllHistory((prev) => !prev)}
                      className="px-5 py-2 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold transition-colors"
                    >
                      {showAllHistory
                        ? 'Lipat Kembali (Tampilkan 6 Terbaru)'
                        : `Tampilkan Semua Riwayat (${filteredOrders.length} Transaksi)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}