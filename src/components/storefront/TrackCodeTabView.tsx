'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  KeyRound,
  Search,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Crown,
  MessageCircle,
  Send,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SubscriptionOrder, formatRupiah } from './StorefrontTypes';

interface TrackCodeTabViewProps {
  initialOrder: SubscriptionOrder | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  onJumpToSubscriptionCatalog: () => void;
}

export default function TrackCodeTabView({
  initialOrder,
  whatsappUrl,
  telegramUrl,
  onJumpToSubscriptionCatalog,
}: TrackCodeTabViewProps) {
  const [codeInput, setCodeInput] = useState('');
  const [orderData, setOrderData] = useState(
    null as SubscriptionOrder | null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSimMode, setIsSimMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null as string | null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Jika pengguna baru saja membuat kode 4 angka dari pop-up produk, tampilkan otomatis
  useEffect(() => {
    if (initialOrder) {
      setCodeInput(initialOrder.code);
      setOrderData(initialOrder);
      setErrorMsg(null);
    }
  }, [initialOrder]);

  const handleCheckCode = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const cleanCode = (overrideCode ?? codeInput).trim();
    if (cleanCode.length < 4) {
      setErrorMsg('Harap masukkan 4 angka kode antrian kamu.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/subscriptions?code=${encodeURIComponent(cleanCode)}`
      );
      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        setOrderData(null);
        throw new Error(
          data.error || `Kode 4 angka "${cleanCode}" tidak ditemukan.`
        );
      }

      setOrderData(data.subscription);
      setIsSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memeriksa kode antrian.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQris = async (code: string) => {
    setIsProcessingPayment(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_QRIS',
          code,
        }),
      });

      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        throw new Error(data.error || 'Gagal menyiapkan kode QRIS.');
      }

      setOrderData(data.subscription);
      setIsSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal membuat pembayaran QRIS.'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSimulatePaymentSuccess = async (code: string) => {
    setIsProcessingPayment(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_PAYMENT',
          code,
        }),
      });

      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        throw new Error(data.error || 'Gagal memproses konfirmasi pembayaran.');
      }

      setOrderData(data.subscription);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengonfirmasi pembayaran.'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCopyAccountText = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-12 space-y-7">
      {/* ==================================================================== */}
      {/* KARTU UTAMA INPUT KODE 4 ANGKA BERLATAR HIJAU GELAP (#0F2A1D) */}
      {/* ==================================================================== */}
      <section className="rounded-[32px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-8 border border-[#375534] relative overflow-hidden shadow-lg">
        <div className="w-56 h-56 rounded-full bg-[#375534]/40 blur-3xl absolute -top-16 -right-12 pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#375534] text-[#E3EED4] text-[11px] font-extrabold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Pelacakan Khusus Produk Tipe Langganan</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Lacak Kode Antrian 4 Angka
            </h1>
            <p className="text-xs sm:text-sm text-[#AEC3B0] max-w-xl leading-relaxed">
              Masukkan 4 angka kode pre-order/antrian yang kamu dapatkan saat memilih produk langganan untuk melihat konfirmasi stok Admin, membayar QRIS, atau menyalin detail akunmu.
            </p>
          </div>

          <form
            onSubmit={(e) => handleCheckCode(e)}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#AEC3B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                maxLength={4}
                value={codeInput}
                onChange={(e) =>
                  setCodeInput(e.target.value.replace(/[^0-9]/g, ''))
                }
                placeholder="Ketik 4 angka kode (Contoh: 4829)"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-[#375534]/65 border border-[#6B9071]/50 text-base font-extrabold tracking-widest text-white placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-[#AEC3B0] focus:outline-none focus:border-[#E3EED4]"
              />
            </div>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.96 }}
              disabled={isLoading || codeInput.length < 4}
              className="px-7 py-3.5 rounded-full bg-[#E3EED4] hover:bg-white disabled:bg-[#375534] disabled:text-[#AEC3B0] text-[#0F2A1D] font-extrabold text-xs sm:text-sm transition-all shrink-0 shadow-sm"
            >
              {isLoading ? 'Memeriksa Kode...' : 'Cek Status Sekarang'}
            </motion.button>
          </form>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-400/40 text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* HASIL PENGECEKAN STATUS KODE 4 ANGKA (JIKA DITEMUKAN) */}
      {/* ==================================================================== */}
      {orderData && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] bg-white border-2 border-[#6B9071]/50 p-5 sm:p-7 rf-card-shadow space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#AEC3B0]/40 pb-4">
            <div className="flex items-center gap-3.5">
              <img
                src={orderData.product_thumbnail || '/logo.jpg'}
                alt={orderData.product_title}
                className="w-14 h-14 rounded-2xl object-cover bg-[#E3EED4] border border-[#AEC3B0]/50 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold tracking-wider">
                    #{orderData.code}
                  </span>
                  <span className="text-xs font-bold text-[#6B9071]">
                    {orderData.customer_name}
                  </span>
                </div>
                <h2 className="font-extrabold text-base sm:text-lg text-[#0F2A1D] mt-1">
                  {orderData.product_title}
                </h2>
                <span className="text-xs font-extrabold text-[#375534]">
                  {formatRupiah(orderData.product_price)}
                </span>
              </div>
            </div>

            {/* Badge 3 Status Utama Sesuai Permintaan */}
            <div className="self-start sm:self-center">
              {orderData.status === 'MENUNGGU_ADMIN' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] text-xs font-extrabold">
                  <Clock className="w-3.5 h-3.5 text-[#375534]" />
                  <span>1. Menunggu Jawaban Admin</span>
                </span>
              )}
              {orderData.status === 'STOK_TERSEDIA' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#375534] text-white text-xs font-extrabold">
                  <QrCode className="w-3.5 h-3.5 text-[#E3EED4]" />
                  <span>Stok Tersedia — Silakan Bayar</span>
                </span>
              )}
              {orderData.status === 'DIPROSES' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E3EED4]" />
                  <span>2. Pesanan Diproses</span>
                </span>
              )}
              {orderData.status === 'DIBATALKAN' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-xs font-extrabold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>3. Pesanan Dibatalkan</span>
                </span>
              )}
            </div>
          </div>

          {/* Keterangan Admin & Batas Waktu 2 Jam */}
          <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 space-y-2 text-xs sm:text-sm text-[#0F2A1D]">
            <p>
              <strong className="text-[#375534]">Keterangan Status:</strong>{' '}
              {orderData.admin_note}
            </p>
            {orderData.status === 'MENUNGGU_ADMIN' && (
              <p className="text-xs text-[#6B9071] font-semibold">
                ⏱️ Batas waktu tunggu konfirmasi Admin (2 jam) sampai pukul{' '}
                <strong className="text-[#0F2A1D]">
                  {new Date(orderData.expires_wait_at).toLocaleTimeString(
                    'id-ID',
                    { hour: '2-digit', minute: '2-digit' }
                  )}{' '}
                  WIB
                </strong>
                . Jika lewat 2 jam belum dikonfirmasi, antrian otomatis dibatalkan.
              </p>
            )}
            {orderData.status === 'DIPROSES' && (
              <p className="text-xs text-[#375534] font-semibold">
                🔒 Pesanan yang sudah berstatus Diproses tidak dapat dibatalkan.
              </p>
            )}
          </div>

          {/* Area Pembayaran QRIS Saat Stok Dikonfirmasi Tersedia */}
          {orderData.status === 'STOK_TERSEDIA' && (
            <div className="space-y-4">
              {!orderData.qris_string ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={isProcessingPayment}
                  onClick={() => handleGenerateQris(orderData.code)}
                  className="w-full py-4 px-5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <QrCode className="w-4 h-4 text-[#E3EED4]" />
                  <span>
                    {isProcessingPayment
                      ? 'Menyiapkan Kode QRIS...'
                      : `Stok Tersedia! Klik untuk Bayar QRIS (${formatRupiah(orderData.product_price)})`}
                  </span>
                </motion.button>
              ) : (
                <div className="p-5 rounded-3xl bg-[#E3EED4]/55 border border-[#6B9071]/50 text-center space-y-4">
                  <p className="text-xs sm:text-sm font-extrabold text-[#0F2A1D]">
                    Pindai Kode QRIS Resmi di Bawah Ini:
                  </p>
                  <div className="bg-white p-4 rounded-2xl inline-block border border-[#AEC3B0] shadow-xs">
                    {React.createElement(QRCodeSVG, {
                      value: orderData.qris_string,
                      size: 190,
                    })}
                  </div>
                  <p className="text-xs text-[#375534]">
                    Total Pembayaran:{' '}
                    <strong className="text-[#0F2A1D]">
                      {formatRupiah(orderData.product_price)}
                    </strong>
                  </p>

                  {isSimMode && (
                    <div className="max-w-xs mx-auto pt-1">
                      <button
                        type="button"
                        disabled={isProcessingPayment}
                        onClick={() =>
                          handleSimulatePaymentSuccess(orderData.code)
                        }
                        className="w-full py-3 px-4 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs transition-colors"
                      >
                        {isProcessingPayment
                          ? 'Memproses...'
                          : '✨ Simulasikan Pembayaran QRIS Lunas'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Area Pengambilan Detail Akun Saat Sudah Dikirim Admin */}
          {orderData.status === 'DIPROSES' && orderData.delivered_account && (
            <div className="p-5 rounded-2xl bg-[#E3EED4] border-2 border-[#375534] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-[#0F2A1D]">
                  🎉 Detail Akun / Akses Langganan Kamu:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyAccountText(orderData.delivered_account)
                  }
                  className="px-3 py-1.5 rounded-full bg-[#0F2A1D] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  {copiedAccount ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#E3EED4]" />
                      <span>Salin Detail Akun</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-white border border-[#AEC3B0] text-xs font-mono text-[#0F2A1D] whitespace-pre-wrap break-all">
                {orderData.delivered_account}
              </pre>
            </div>
          )}
        </motion.section>
      )}

      {/* ==================================================================== */}
      {/* PANDUAN 2 OPSI PEMBELIAN PRODUK LANGGANAN */}
      {/* ==================================================================== */}
      <section className="bg-white rounded-[28px] border border-[#AEC3B0]/50 p-6 sm:p-7 rf-card-shadow space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold text-[#375534]">
              👑 Panduan Lengkap Produk Langganan
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2A1D]">
              2 Cara Mudah Membeli Akun Premium di RizzFlow
            </h2>
          </div>

          <button
            type="button"
            onClick={onJumpToSubscriptionCatalog}
            className="self-start sm:self-center px-4 py-2 rounded-full bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Lihat Katalog Langganan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opsi 1: Chat Langsung */}
          <div className="p-5 rounded-2xl bg-[#E3EED4]/55 border border-[#AEC3B0]/70 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-[11px] font-extrabold">
                OPSI 1 • Respon Cepat via Chat
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D]">
                Hubungi Admin Langsung via WhatsApp / Telegram
              </h3>
              <p className="text-xs text-[#375534] leading-relaxed">
                Saat kamu memilih produk langganan di katalog, kamu bisa langsung menekan tombol WhatsApp atau Telegram untuk menanyakan stok dan bertransaksi langsung dengan Admin.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat WhatsApp</span>
                </a>
              )}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Chat Telegram</span>
                </a>
              )}
            </div>
          </div>

          {/* Opsi 2: Kode 4 Angka di Web */}
          <div className="p-5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/70 space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-[#375534] text-white text-[11px] font-extrabold">
              OPSI 2 • Transaksi Mandiri di Website
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D]">
              Ambil Kode 4 Angka &amp; Terima Notifikasi Email
            </h3>
            <ul className="text-xs text-[#375534] space-y-1.5 leading-relaxed list-decimal pl-4">
              <li>
                Pilih produk langganan dan ambil <strong>Kode 4 Angka</strong> tanpa bayar di awal.
              </li>
              <li>
                Admin mengecek stok (maksimal 2 jam) dan mengirimkan email konfirmasi ke kamu.
              </li>
              <li>
                Masukkan Kode 4 Angka di halaman ini untuk membayar via QRIS dan menerima detail akunmu.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}