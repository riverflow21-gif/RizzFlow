'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Mail,
  Tag,
  Plus,
  Minus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CartItem, Order, PromoValidationResult } from '@/types';

const CART_STORAGE_KEY = 'rizzflow_cart_v1';

export default function GuestCheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [email, setEmail] = useState<string>('');
  const [promoInput, setPromoInput] = useState<string>('');
  const [promoStatus, setPromoStatus] = useState<PromoValidationResult | null>(null);
  const [isCheckingPromo, setIsCheckingPromo] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State setelah tagihan QRIS dibuat
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);

  // Muat isi keranjang dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.error('Gagal membaca keranjang:', e);
    }
  }, []);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const discountAmount = promoStatus?.valid ? promoStatus.discount_amount : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Fungsi mengubah jumlah produk langsung di halaman Checkout
  const updateItemQuantity = (productId: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.product.id === productId) {
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    setCart(updated);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
    // Reset perhitungan kode promo jika isi keranjang berubah
    setPromoStatus(null);
  };

  // Fungsi mengecek Kode Promo ke API Server
  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setIsCheckingPromo(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput.trim(),
          subtotal,
        }),
      });
      const data = (await response.json()) as PromoValidationResult;
      setPromoStatus(data);
    } catch {
      setPromoStatus({
        valid: false,
        message: 'Gagal memeriksa kode promo. Silakan coba lagi.',
        discount_amount: 0,
        promo_code: null,
      });
    } finally {
      setIsCheckingPromo(false);
    }
  };

  // Fungsi memproses tombol "Beli Sekarang" untuk menerbitkan QRIS DOKU
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Alamat email wajib diisi untuk menerima link unduhan produk.');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Keranjang belanja kamu kosong.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          promo_code: promoStatus?.valid ? promoStatus.promo_code : null,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = (await response.json()) as {
        order?: Order;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!response.ok || !result.order) {
        throw new Error(result.error || 'Gagal membuat tagihan QRIS.');
      }

      setActiveOrder(result.order);
      setIsSimulationMode(Boolean(result.simulation_mode));
      // Kosongkan keranjang setelah tagihan QRIS berhasil dibuat
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat pesanan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hitung mundur waktu kedaluwarsa QRIS (1 Jam / 3600 Detik)
  useEffect(() => {
    if (!activeOrder || activeOrder.payment_status !== 'PENDING') return;

    const updateTimer = () => {
      const expiresMs = new Date(activeOrder.qris_expires_at).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec === 0) {
        setActiveOrder((prev) =>
          prev ? { ...prev, payment_status: 'EXPIRED' } : null
        );
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [activeOrder]);

  // Polling otomatis setiap 4 detik untuk mendeteksi apakah pembayaran QRIS sudah lunas
  useEffect(() => {
    if (!activeOrder || activeOrder.payment_status !== 'PENDING') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrder.invoice_number}`);
        if (res.ok) {
          const data = (await res.json()) as { order?: Order };
          if (data.order && data.order.payment_status !== activeOrder.payment_status) {
            setActiveOrder(data.order);
          }
        }
      } catch (e) {
        console.error('Gagal mengecek status pembayaran:', e);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [activeOrder]);

  // Fungsi khusus Mode Latihan/Simulasi untuk mengetes pelunasan & pengiriman email otomatis
  const handleSimulatePaymentSuccess = async () => {
    if (!activeOrder) return;
    setIsSimulatingPayment(true);
    try {
      await fetch('/api/webhooks/doku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            invoice_number: activeOrder.invoice_number,
            amount: activeOrder.final_amount,
          },
          transaction: {
            status: 'SUCCESS',
            date: new Date().toISOString(),
          },
        }),
      });

      const res = await fetch(`/api/orders/${activeOrder.invoice_number}`);
      if (res.ok) {
        const data = (await res.json()) as { order?: Order };
        if (data.order) {
          setActiveOrder(data.order);
        }
      }
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  // Format detik menjadi MM:SS
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-6 sm:py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Navigasi Kembali ke Katalog */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Utama</span>
          </Link>
        </div>

        {/* TAMPILAN 1: STATUS PEMBAYARAN BERHASIL (PAID) */}
        {activeOrder && activeOrder.payment_status === 'PAID' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 15 }}
              className="w-16 h-16 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>

            <h1 className="text-2xl font-extrabold text-[#0F172A] mb-2">
              Pembayaran Berhasil!
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed mb-6">
              Terima kasih! Sistem kami telah mendeteksi pembayaranmu untuk pesanan{' '}
              <strong className="text-[#0F172A]">#{activeOrder.invoice_number}</strong>.
              Link unduhan produk digital telah dikirim otomatis ke email:
            </p>

            <div className="py-3 px-4 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-[#059669] font-bold text-sm mb-6 break-all">
              {activeOrder.customer_email}
            </div>

            <p className="text-xs text-[#64748B] mb-6">
              Silakan periksa kotak masuk (Inbox) atau folder Spam/Promosi pada email kamu.
            </p>

            <Link
              href="/"
              className="w-full py-3.5 px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>Kembali ke Halaman Utama</span>
            </Link>
          </motion.div>
        )}

        {/* TAMPILAN 2: MENUNGGU PEMBAYARAN QRIS (PENDING / EXPIRED) */}
        {activeOrder && activeOrder.payment_status !== 'PAID' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center"
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669] mb-3">
              Tagihan #{activeOrder.invoice_number}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-1">
              Pindai QRIS untuk Membayar
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mb-5">
              File produk akan dikirim otomatis ke <strong>{activeOrder.customer_email}</strong> begitu pembayaran selesai.
            </p>

            {/* Hitung Mundur Waktu Kedaluwarsa 1 Jam */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold mb-6 ${
                activeOrder.payment_status === 'EXPIRED' || remainingSeconds === 0
                  ? 'bg-red-50 text-[#EF4444] border border-red-200'
                  : 'bg-[#F8FAFC] text-[#0F172A] border border-slate-200'
              }`}
            >
              <Clock className="w-4 h-4 text-[#10B981]" />
              {activeOrder.payment_status === 'EXPIRED' || remainingSeconds === 0 ? (
                <span>Waktu Pembayaran QRIS Telah Habis (Kedaluwarsa)</span>
              ) : (
                <span>Batas Waktu Bayar: {formatCountdown(remainingSeconds)}</span>
              )}
            </div>

            {/* Kotak Kode QRIS */}
            {activeOrder.payment_status === 'PENDING' && remainingSeconds > 0 && (
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-6 max-w-xs mx-auto mb-6 flex flex-col items-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs mb-3">
                  <QRCodeSVG
                    value={activeOrder.qris_string || activeOrder.invoice_number}
                    size={200}
                    level="M"
                  />
                </div>
                <span className="text-xs font-semibold text-[#64748B]">
                  Menerima Semua M-Banking & E-Wallet (QRIS)
                </span>
              </div>
            )}

            <div className="bg-[#F8FAFC] rounded-xl p-4 mb-6 text-left space-y-2 border border-slate-100">
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>Subtotal</span>
                <span>Rp{activeOrder.subtotal_amount.toLocaleString('id-ID')}</span>
              </div>
              {activeOrder.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-[#059669] font-semibold">
                  <span>Diskon Promo ({activeOrder.promo_code_used})</span>
                  <span>-Rp{activeOrder.discount_amount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-[#0F172A] pt-2 border-t border-slate-200">
                <span>Total Tagihan</span>
                <span className="text-[#10B981]">
                  Rp{activeOrder.final_amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-[#64748B] mb-6">
              <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
              <span>Sistem sedang mendeteksi pembayaranmu secara otomatis...</span>
            </div>

            {/* Tombol Simulasi Khusus Mode Latihan Lokal */}
            {isSimulationMode && activeOrder.payment_status === 'PENDING' && (
              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-emerald-200 mb-4">
                <p className="text-xs text-[#059669] font-medium mb-2.5">
                  <strong>Mode Simulasi Aktif:</strong> Klik tombol di bawah ini untuk mengetes pembayaran lunas otomatis beserta pengiriman email produk.
                </p>
                <button
                  type="button"
                  onClick={handleSimulatePaymentSuccess}
                  disabled={isSimulatingPayment}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isSimulatingPayment
                      ? 'Memproses Pelunasan & Mengirim Email...'
                      : 'Simulasikan Pembayaran Lunas Sekarang'}
                  </span>
                </button>
              </div>
            )}

            <Link
              href="/"
              className="inline-block text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
            >
              Kembali ke Halaman Utama
            </Link>
          </motion.div>
        )}

        {/* TAMPILAN 3: FORMULIR GUEST CHECKOUT */}
        {!activeOrder && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-1">
              Checkout Pesanan
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mb-6">
              Tanpa perlu daftar akun. Isi emailmu dan produk langsung dikirim otomatis setelah pembayaran QRIS.
            </p>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-semibold text-[#0F172A] mb-2">
                  Keranjang belanja kamu masih kosong
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10B981] text-white text-sm font-bold"
                >
                  Pilih Produk di Katalog
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateOrder} className="space-y-6">
                {/* Daftar Produk & Pengaturan Jumlah */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Ringkasan Produk ({cart.length})
                  </label>
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200/80"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.product.thumbnail_url}
                          alt={item.product.title}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[#0F172A] truncate">
                            {item.product.title}
                          </h3>
                          <p className="text-xs font-semibold text-[#10B981]">
                            Rp{item.product.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.product.id, -1)}
                            className="text-[#64748B] hover:text-[#0F172A]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.product.id, 1)}
                            className="text-[#64748B] hover:text-[#0F172A]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateItemQuantity(item.product.id, -item.quantity)
                          }
                          className="text-[#64748B] hover:text-[#EF4444] p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Wajib Alamat Email */}
                <div>
                  <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                    Alamat Email Penerima Produk <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: nama@email.com"
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#10B981] focus:bg-white"
                    />
                  </div>
                  <p className="text-xs text-[#64748B] mt-1.5">
                    Pastikan email aktif. Link download file produk akan dikirim otomatis ke alamat email ini.
                  </p>
                </div>

                {/* Kolom Input Kode Promo */}
                <div>
                  <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                    Kode Promo (Opsional)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode promo (misal: HEMAT20)"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm uppercase text-[#0F172A] focus:outline-none focus:border-[#10B981] focus:bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={isCheckingPromo || !promoInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
                    >
                      {isCheckingPromo ? 'Mengecek...' : 'Gunakan'}
                    </button>
                  </div>

                  {promoStatus && (
                    <p
                      className={`text-xs font-semibold mt-2 ${
                        promoStatus.valid ? 'text-[#059669]' : 'text-[#EF4444]'
                      }`}
                    >
                      {promoStatus.message}
                    </p>
                  )}
                </div>

                {/* Rincian Total Pembayaran */}
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-sm text-[#64748B]">
                    <span>Subtotal Produk</span>
                    <span>Rp{subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-[#059669]">
                      <span>Potongan Kode Promo ({promoStatus?.promo_code})</span>
                      <span>-Rp{discountAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-[#0F172A] pt-2 border-t border-slate-200">
                    <span>Total Pembayaran</span>
                    <span className="text-[#10B981]">
                      Rp{finalTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#EF4444] text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuat Tagihan QRIS...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Beli Sekarang (Bayar via QRIS)</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}