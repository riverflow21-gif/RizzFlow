'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sparkles,
  Check,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  MessageSquarePlus,
  QrCode,
  MessageCircle,
  KeyRound,
  Search,
  Copy,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  CustomServiceConfig,
  CustomProjectOrder,
  DeliveryLinkItem,
  FAQ_ITEMS,
  formatRupiah,
} from './StorefrontTypes';

interface ServicesTabViewProps {
  customService: CustomServiceConfig;
  storeName: string;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

type MessageCategoryType = 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN';

interface FeedbackState {
  type: 'success' | 'error';
  text: string;
}

type NullableFeedback = FeedbackState | null;
type NullableNumber = number | null;
type NullableCustomOrder = CustomProjectOrder | null;
type NullableString = string | null;

export default function ServicesTabView({
  customService,
  storeName,
  whatsappUrl,
  telegramUrl,
}: ServicesTabViewProps) {
  const formRef = useRef(null as HTMLDivElement | null);
  const trackSectionRef = useRef(null as HTMLDivElement | null);

  // State Pelacakan & Tagihan Kode Pesanan Kustom (KST-XXXX)
  const [orderCodeInput, setOrderCodeInput] = useState('');
  const [checkedOrder, setCheckedOrder] = useState(
    null as NullableCustomOrder
  );
  const [unlockedFiles, setUnlockedFiles] = useState(
    [] as DeliveryLinkItem[]
  );
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isProcessingBill, setIsProcessingBill] = useState(false);
  const [isSimMode, setIsSimMode] = useState(false);
  const [checkError, setCheckError] = useState(null as NullableString);

  // State Formulir Pesan Jasa Kustom & Klaim Garansi
  const [msgType, setMsgType] = useState(
    'LAYANAN_KHUSUS' as MessageCategoryType
  );
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null as NullableFeedback);
  const [createdOrderCode, setCreatedOrderCode] = useState(
    null as NullableString
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0 as NullableNumber);

  const handleSelectServiceChip = (serviceName: string) => {
    setMsgType('LAYANAN_KHUSUS');
    setProjectTitle(serviceName);
    setMessageText(
      `Halo Admin ${storeName}, saya ingin memesan layanan "${serviceName}". Berikut rincian kebutuhan saya: `
    );
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Cek Kode Pesanan Kustom (KST-XXXX)
  const handleCheckCustomOrder = async (
    e?: React.FormEvent,
    overrideCode?: string
  ) => {
    if (e) e.preventDefault();
    const rawCode = (overrideCode ?? orderCodeInput).trim().toUpperCase();
    if (!rawCode) return;

    const normalizedCode =
      rawCode.length === 4 && !rawCode.startsWith('KST-')
        ? `KST-${rawCode}`
        : rawCode;

    setIsCheckingCode(true);
    setCheckError(null);
    try {
      const res = await fetch(
        `/api/messages?order_code=${encodeURIComponent(normalizedCode)}`
      );
      const data = (await res.json()) as {
        customOrder?: CustomProjectOrder;
        unlockedFiles?: DeliveryLinkItem[];
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.customOrder) {
        setCheckedOrder(null);
        setUnlockedFiles([]);
        throw new Error(
          data.error || `Kode Pesanan "${normalizedCode}" tidak ditemukan.`
        );
      }

      setOrderCodeInput(data.customOrder.order_code);
      setCheckedOrder(data.customOrder);
      setUnlockedFiles(data.unlockedFiles || []);
      setIsSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : 'Gagal memeriksa kode pesanan.'
      );
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Buat QRIS Tagihan Layanan Kustom
  const handleGenerateCustomQris = async (orderCode: string) => {
    setIsProcessingBill(true);
    setCheckError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_CUSTOM_QRIS',
          order_code: orderCode,
        }),
      });

      const data = (await res.json()) as {
        customOrder?: CustomProjectOrder;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.customOrder) {
        throw new Error(data.error || 'Gagal menyiapkan kode QRIS tagihan.');
      }

      setCheckedOrder(data.customOrder);
      setIsSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : 'Gagal membuat tagihan QRIS.'
      );
    } finally {
      setIsProcessingBill(false);
    }
  };

  // Konfirmasi / Simulasi Pelunasan Tagihan Kustom -> Buka & Kirim File Otomatis
  const handleConfirmCustomPayment = async (orderCode: string) => {
    setIsProcessingBill(true);
    setCheckError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_CUSTOM_PAYMENT',
          order_code: orderCode,
        }),
      });

      const data = (await res.json()) as {
        customOrder?: CustomProjectOrder;
        unlockedFiles?: DeliveryLinkItem[];
        error?: string;
      };

      if (!res.ok || !data.customOrder) {
        throw new Error(data.error || 'Gagal memproses pembayaran tagihan.');
      }

      setCheckedOrder(data.customOrder);
      setUnlockedFiles(data.unlockedFiles || []);
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : 'Gagal mengonfirmasi pembayaran.'
      );
    } finally {
      setIsProcessingBill(false);
    }
  };

  // Kirim Pesan / Buat Pesanan Layanan Kustom Baru
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreatedOrderCode(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_MESSAGE',
          type: msgType,
          sender_name: senderName,
          sender_email: senderEmail,
          sender_contact: senderContact,
          project_title:
            msgType === 'LAYANAN_KHUSUS'
              ? projectTitle.trim() || 'Pesanan Layanan Kustom'
              : undefined,
          invoice_number: invoiceNumber,
          message: messageText,
        }),
      });

      const data = (await res.json()) as {
        customOrder?: CustomProjectOrder;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan.');
      }

      if (data.customOrder) {
        setCreatedOrderCode(data.customOrder.order_code);
        setOrderCodeInput(data.customOrder.order_code);
        setCheckedOrder(data.customOrder);
      }

      setFeedback({
        type: 'success',
        text:
          data.message ||
          'Pesan berhasil dikirim ke Admin! Kami akan segera merespons.',
      });
      setSenderName('');
      setInvoiceNumber('');
      setMessageText('');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim pesan.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-5 pb-12 space-y-8">
      {/* ==================================================================== */}
      {/* 1. KOLOM CEK KODE PESANAN KUSTOM & HALAMAN TAGIHAN (KST-XXXX) */}
      {/* ==================================================================== */}
      <section
        ref={trackSectionRef}
        className="rounded-[32px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-8 border border-[#375534] shadow-lg relative overflow-hidden space-y-5"
      >
        <div className="w-60 h-60 rounded-full bg-[#375534]/40 blur-3xl absolute -top-20 -right-12 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#375534] text-[#E3EED4] text-xs font-extrabold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Halaman Tagihan &amp; Akses Produk Kustom</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Cek Kode Pesanan Layanan Kustom
            </h1>
            <p className="text-xs sm:text-sm text-[#AEC3B0] max-w-2xl leading-relaxed">
              Sudah memesan pembuatan web sederhana, template Excel, atau jasa kustom? Masukkan <strong>Kode Pesanan (Contoh: KST-4829)</strong> yang dikirim ke emailmu untuk melihat tagihan, membayar via QRIS, dan mengunduh produk kustommu.
            </p>
          </div>

          <form
            onSubmit={(e) => handleCheckCustomOrder(e)}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#AEC3B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={orderCodeInput}
                onChange={(e) =>
                  setOrderCodeInput(e.target.value.toUpperCase())
                }
                placeholder="Ketik Kode Pesanan Kustom (Contoh: KST-4829)"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-[#375534]/65 border border-[#6B9071]/50 text-sm sm:text-base font-extrabold tracking-wider uppercase text-white placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-[#AEC3B0] focus:outline-none focus:border-[#E3EED4]"
              />
            </div>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.96 }}
              disabled={isCheckingCode || !orderCodeInput.trim()}
              className="px-7 py-3.5 rounded-full bg-[#E3EED4] hover:bg-white disabled:bg-[#375534] disabled:text-[#AEC3B0] text-[#0F2A1D] font-extrabold text-xs sm:text-sm transition-all shrink-0 shadow-sm"
            >
              {isCheckingCode ? 'Mencari...' : 'Buka Tagihan / Pesanan'}
            </motion.button>
          </form>

          {checkError && (
            <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-400/40 text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
              <span>{checkError}</span>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* HASIL PENGECEKAN KODE PESANAN KUSTOM (TAGIHAN QRIS & UNDUH PRODUK) */}
      {/* ==================================================================== */}
      {checkedOrder && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] bg-white border-2 border-[#6B9071] p-6 sm:p-7 rf-card-shadow space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#AEC3B0]/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold tracking-wider">
                  {checkedOrder.order_code}
                </span>
                <span className="text-xs font-bold text-[#6B9071]">
                  Pemesan: {checkedOrder.customer_name}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2A1D] mt-1.5">
                {checkedOrder.project_title}
              </h2>
            </div>

            <div className="self-start sm:self-center">
              {checkedOrder.status === 'MENUNGGU_PENGERJAAN' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] text-xs font-extrabold">
                  <Clock className="w-3.5 h-3.5 text-[#375534]" />
                  <span>Sedang Dikerjakan Admin</span>
                </span>
              )}
              {checkedOrder.status === 'SIAP_DIBAYAR' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#375534] text-white text-xs font-extrabold">
                  <QrCode className="w-3.5 h-3.5 text-[#E3EED4]" />
                  <span>Produk Selesai — Menunggu Pembayaran</span>
                </span>
              )}
              {checkedOrder.status === 'LUNAS' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E3EED4]" />
                  <span>Lunas — Produk Siap Diunduh</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 space-y-2 text-xs sm:text-sm text-[#0F2A1D]">
            <p>
              <strong className="text-[#375534]">Keterangan Admin:</strong>{' '}
              {checkedOrder.admin_note}
            </p>
            {checkedOrder.price > 0 && (
              <p className="text-base font-extrabold text-[#0F2A1D] pt-1">
                Total Tagihan Layanan Kustom:{' '}
                <span className="text-[#375534]">
                  {formatRupiah(checkedOrder.price)}
                </span>
              </p>
            )}
          </div>

          {/* Tampilan Pembayaran Tagihan QRIS Saat Produk Selesai Dikerjakan */}
          {checkedOrder.status === 'SIAP_DIBAYAR' && (
            <div className="space-y-4">
              {!checkedOrder.qris_string ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={isProcessingBill}
                  onClick={() =>
                    handleGenerateCustomQris(checkedOrder.order_code)
                  }
                  className="w-full py-4 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <QrCode className="w-4 h-4 text-[#E3EED4]" />
                  <span>
                    {isProcessingBill
                      ? 'Menyiapkan Kode QRIS Tagihan...'
                      : `Bayar Tagihan Sekarang via QRIS (${formatRupiah(checkedOrder.price)})`}
                  </span>
                </motion.button>
              ) : (
                <div className="p-5 rounded-3xl bg-[#E3EED4]/55 border border-[#6B9071]/50 text-center space-y-4">
                  <p className="text-xs sm:text-sm font-extrabold text-[#0F2A1D]">
                    Pindai Kode QRIS Resmi di Bawah Ini Untuk Melunasi Tagihan:
                  </p>
                  <div className="bg-white p-4 rounded-2xl inline-block border border-[#AEC3B0] shadow-xs">
                    {React.createElement(QRCodeSVG, {
                      value: checkedOrder.qris_string,
                      size: 195,
                    })}
                  </div>
                  <p className="text-xs text-[#375534]">
                    Begitu pembayaran selesai, file produk kustommu akan langsung terbuka di halaman ini dan dikirim ke email{' '}
                    <strong className="text-[#0F2A1D]">
                      {checkedOrder.customer_email}
                    </strong>
                    .
                  </p>

                  {isSimMode && (
                    <div className="max-w-xs mx-auto pt-1">
                      <button
                        type="button"
                        disabled={isProcessingBill}
                        onClick={() =>
                          handleConfirmCustomPayment(checkedOrder.order_code)
                        }
                        className="w-full py-3 px-4 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs transition-colors"
                      >
                        {isProcessingBill
                          ? 'Memproses Pelunasan...'
                          : '✨ Simulasikan Pembayaran Tagihan Lunas'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tampilan Tombol Unduh Produk Kustom Setelah Dibayar Lunas */}
          {checkedOrder.status === 'LUNAS' && (
            <div className="p-5 rounded-2xl bg-[#E3EED4] border-2 border-[#375534] space-y-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#0F2A1D]">
                🎉 Terima Kasih! Berikut File &amp; Link Produk Kustom Kamu:
              </div>

              {unlockedFiles.length === 0 ? (
                <p className="text-xs text-[#375534]">
                  File produk kustom juga telah dikirimkan ke alamat email{' '}
                  <strong>{checkedOrder.customer_email}</strong>.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {unlockedFiles.map((fileItem, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-[#AEC3B0] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D]">
                        {fileItem.productTitle}
                      </span>
                      <a
                        href={fileItem.signedDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <span>Buka &amp; Unduh Produk</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.section>
      )}

      {/* ==================================================================== */}
      {/* 2. KARTU DAFTAR LAYANAN KUSTOM (DIATUR DARI ADMIN) */}
      {/* ==================================================================== */}
      <section className="rounded-[28px] bg-[#E3EED4] border border-[#AEC3B0] p-6 sm:p-7 space-y-4">
        <div className="space-y-1.5 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#375534] text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Katalog Jasa Kustom {storeName}</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D]">
            {customService.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#375534] leading-relaxed">
            {customService.description}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#375534] mb-2">
            Ketuk salah satu layanan di bawah untuk langsung mengisi formulir pesanan:
          </p>
          <div className="flex flex-wrap gap-2">
            {customService.services.map((srv, idx) => (
              <motion.button
                key={idx}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectServiceChip(srv)}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#0F2A1D] text-[#0F2A1D] hover:text-[#E3EED4] border border-[#AEC3B0] text-xs font-extrabold inline-flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-[#375534] shrink-0" />
                <span>{srv}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {(whatsappUrl || telegramUrl) && (
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#E3EED4]" />
                <span>Tanya via WhatsApp</span>
              </a>
            )}
            {telegramUrl && (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-full bg-white hover:bg-[#375534] text-[#0F2A1D] hover:text-white border border-[#AEC3B0] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Chat via Telegram</span>
              </a>
            )}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 3. FORMULIR PESAN LAYANAN KUSTOM & KLAIM GARANSI + FAQ */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          ref={formRef}
          className="lg:col-span-7 bg-white border border-[#AEC3B0]/60 rounded-[28px] p-6 sm:p-7 rf-card-shadow"
        >
          <div className="flex items-center gap-2 mb-1">
            <MessageSquarePlus className="w-5 h-5 text-[#375534]" />
            <h2 className="text-lg font-extrabold text-[#0F2A1D]">
              Formulir Pesan Layanan Kustom &amp; Klaim Garansi
            </h2>
          </div>
          <p className="text-xs text-[#6B9071] mb-5">
            Saat kamu memesan Jasa Kustom, sistem otomatis memberikan <strong>Kode Pesanan (KST-XXXX)</strong> ke layar dan emailmu.
          </p>

          <form onSubmit={handleSendMessage} className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 bg-[#F6F8F3] p-1.5 rounded-full border border-[#AEC3B0]/50">
              <button
                type="button"
                onClick={() => setMsgType('LAYANAN_KHUSUS')}
                className={
                  msgType === 'LAYANAN_KHUSUS'
                    ? 'py-2 px-2 rounded-full text-[11px] font-extrabold bg-[#0F2A1D] text-white transition-all'
                    : 'py-2 px-2 rounded-full text-[11px] font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
                }
              >
                ✨ Jasa Kustom
              </button>
              <button
                type="button"
                onClick={() => setMsgType('KLAIM_GARANSI')}
                className={
                  msgType === 'KLAIM_GARANSI'
                    ? 'py-2 px-2 rounded-full text-[11px] font-extrabold bg-[#375534] text-white transition-all'
                    : 'py-2 px-2 rounded-full text-[11px] font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
                }
              >
                🛡️ Klaim Garansi
              </button>
              <button
                type="button"
                onClick={() => setMsgType('PERTANYAAN')}
                className={
                  msgType === 'PERTANYAAN'
                    ? 'py-2 px-2 rounded-full text-[11px] font-extrabold bg-[#0F2A1D] text-white transition-all'
                    : 'py-2 px-2 rounded-full text-[11px] font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
                }
              >
                💬 Tanya Admin
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Nama Kamu *"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="Email Aktif Kamu *"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Nomor WhatsApp (Agar Mudah Dihubungi)"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />

              {msgType === 'LAYANAN_KHUSUS' ? (
                <input
                  type="text"
                  required
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Nama Proyek (Misal: Web Landing Page) *"
                  className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                />
              ) : (
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Nomor Invoice (Jika Klaim Garansi)"
                  className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                />
              )}
            </div>

            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={
                msgType === 'KLAIM_GARANSI'
                  ? 'Tuliskan kendalamu (misal: Pembayaran QRIS selesai tapi file belum masuk ke email)...'
                  : 'Jelaskan detail website sederhana, rumus Excel, atau produk kustom yang ingin kamu buat...'
              }
              className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
            />

            {/* Kotak Kode Pesanan Kustom (KST-XXXX) Saat Berhasil Memesan */}
            {createdOrderCode && (
              <div className="p-4 rounded-2xl bg-[#E3EED4] border-2 border-[#375534] text-center space-y-2">
                <span className="text-[11px] font-extrabold text-[#375534] uppercase">
                  Kode Pesanan Layanan Kustom Kamu:
                </span>
                <div className="text-2xl font-extrabold text-[#0F2A1D] tracking-wider">
                  {createdOrderCode}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(createdOrderCode)}
                    className="px-4 py-1.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kode Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Kode Pesanan</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#375534]">
                  Simpan kode di atas! Saat produk selesai dikerjakan, kamu akan mendapat email dan bisa membayar tagihannya di bagian atas halaman ini.
                </p>
              </div>
            )}

            {feedback && (
              <div
                className={
                  feedback.type === 'success'
                    ? 'p-3.5 rounded-2xl bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] text-xs font-bold flex items-center gap-2'
                    : 'p-3.5 rounded-2xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-2'
                }
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#375534]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={isSending}
              className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim Permintaan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E3EED4]" />
                  <span>
                    {msgType === 'LAYANAN_KHUSUS'
                      ? 'Buat Pesanan Kustom & Ambil Kode'
                      : 'Kirim Pesan ke Admin'}
                  </span>
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* Kolom Kanan: Tanya Jawab (FAQ) */}
        <div className="lg:col-span-5 bg-white border border-[#AEC3B0]/60 rounded-[28px] p-6 rf-card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-[#375534]" />
            <h2 className="text-lg font-extrabold text-[#0F2A1D]">
              Tanya Jawab (FAQ)
            </h2>
          </div>

          <div className="space-y-2.5">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#AEC3B0]/50 overflow-hidden bg-[#F6F8F3]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-2 font-extrabold text-xs text-[#0F2A1D]"
                  >
                    <span>{item.q}</span>
                    <span
                      className={
                        isOpen
                          ? 'rotate-180 text-[#375534] transition-transform shrink-0'
                          : 'text-[#6B9071] transition-transform shrink-0'
                      }
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2.5 text-xs text-[#375534] leading-relaxed border-t border-[#AEC3B0]/40 bg-white">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}