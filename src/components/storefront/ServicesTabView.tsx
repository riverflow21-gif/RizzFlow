'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
  MousePointerClick,
  QrCode,
  MailCheck,
  MessageCircle,
} from 'lucide-react';
import { CustomServiceConfig, FAQ_ITEMS } from './StorefrontTypes';

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

export default function ServicesTabView({
  customService,
  storeName,
  whatsappUrl,
  telegramUrl,
}: ServicesTabViewProps) {
  const formRef = useRef(null as HTMLDivElement | null);

  const [msgType, setMsgType] = useState(
    'LAYANAN_KHUSUS' as MessageCategoryType
  );
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null as NullableFeedback);
  const [openFaqIndex, setOpenFaqIndex] = useState(0 as NullableNumber);

  const handleSelectServiceChip = (serviceName: string) => {
    setMsgType('LAYANAN_KHUSUS');
    setMessageText(
      `Halo Admin ${storeName}, saya ingin memesan layanan "${serviceName}". Berikut detail kebutuhan saya: `
    );
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msgType,
          sender_name: senderName,
          sender_email: senderEmail,
          sender_contact: senderContact,
          invoice_number: invoiceNumber,
          message: messageText,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan.');
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

  return (
    <div className="max-w-5xl mx-auto px-4 pt-5 pb-12 space-y-8">
      {/* ==================================================================== */}
      {/* KARTU SHOWCASE LAYANAN KUSTOM (DIATUR DARI ADMIN) */}
      {/* ==================================================================== */}
      <section className="rounded-[32px] bg-gradient-to-br from-[#0F2A1D] via-[#375534] to-[#6B9071] text-white p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="w-60 h-60 rounded-full bg-[#E3EED4]/15 blur-3xl absolute -bottom-20 -right-12 pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Layanan Kustom &amp; Bantuan Garansi {storeName}</span>
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {customService.title}
          </h1>

          <p className="text-xs sm:text-sm text-[#E3EED4]/90 leading-relaxed">
            {customService.description}
          </p>

          <div className="pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#AEC3B0] mb-2.5">
              Ketuk salah satu layanan di bawah untuk langsung memesan:
            </p>
            <div className="flex flex-wrap gap-2">
              {customService.services.map((srv, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectServiceChip(srv)}
                  className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-[#E3EED4] text-white hover:text-[#0F2A1D] border border-[#E3EED4]/35 text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5 text-[#E3EED4] shrink-0" />
                  <span>{srv}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {(whatsappUrl || telegramUrl) && (
            <div className="pt-3 flex flex-wrap items-center gap-2.5">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Konsultasi via WhatsApp</span>
                </a>
              )}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-full bg-[#0F2A1D]/70 hover:bg-[#0F2A1D] text-[#E3EED4] border border-[#AEC3B0]/40 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Chat via Telegram</span>
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* ALUR BELANJA 3 LANGKAH BERANIMASI (BOTANICAL SAGE STYLE) */}
      {/* ==================================================================== */}
      <section className="rounded-[28px] bg-[#E3EED4] border border-[#AEC3B0] p-5 sm:p-6 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="sm:max-w-[210px] shrink-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#375534]">
              ⚡ Otomatis 24/7
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D] mt-0.5">
              3 Langkah Instan Belanja di {storeName}
            </h2>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2.5 sm:gap-4 relative">
            <div className="hidden sm:block absolute top-6 left-12 right-12 h-0.5 bg-[#AEC3B0] overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.8,
                  ease: 'linear',
                }}
                className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#0F2A1D] to-transparent"
              />
            </div>

            <motion.div
              whileHover={{ y: -2 }}
              className="relative z-10 bg-white/90 border border-[#AEC3B0]/60 rounded-2xl p-3 flex flex-col items-center text-center rf-card-shadow"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                className="w-9 h-9 rounded-full bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center mb-1.5"
              >
                <MousePointerClick className="w-4 h-4" />
              </motion.div>
              <span className="text-xs font-extrabold text-[#0F2A1D]">
                1. Pilih Produk
              </span>
              <span className="text-[10px] text-[#375534] hidden sm:inline mt-0.5">
                Masukkan keranjang
              </span>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              className="relative z-10 bg-white/90 border border-[#AEC3B0]/60 rounded-2xl p-3 flex flex-col items-center text-center rf-card-shadow"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, delay: 0.6 }}
                className="w-9 h-9 rounded-full bg-[#375534] text-white flex items-center justify-center mb-1.5"
              >
                <QrCode className="w-4 h-4" />
              </motion.div>
              <span className="text-xs font-extrabold text-[#0F2A1D]">
                2. Scan QRIS
              </span>
              <span className="text-[10px] text-[#375534] hidden sm:inline mt-0.5">
                Tanpa daftar akun
              </span>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              className="relative z-10 bg-white/90 border border-[#AEC3B0]/60 rounded-2xl p-3 flex flex-col items-center text-center rf-card-shadow"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, delay: 1.2 }}
                className="w-9 h-9 rounded-full bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center mb-1.5"
              >
                <MailCheck className="w-4 h-4" />
              </motion.div>
              <span className="text-xs font-extrabold text-[#0F2A1D]">
                3. Cek Emailmu!
              </span>
              <span className="text-[10px] text-[#375534] hidden sm:inline mt-0.5">
                File langsung masuk
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* FORMULIR CANVAS KLAIM GARANSI & PESAN JASA KUSTOM + FAQ */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Canvas Formulir */}
        <div
          ref={formRef}
          className="lg:col-span-7 bg-white border border-[#AEC3B0]/60 rounded-[28px] p-6 sm:p-7 rf-card-shadow"
        >
          <div className="flex items-center gap-2 mb-1">
            <MessageSquarePlus className="w-5 h-5 text-[#375534]" />
            <h2 className="text-lg font-extrabold text-[#0F2A1D]">
              Canvas Pesan Jasa Kustom &amp; Klaim Garansi
            </h2>
          </div>
          <p className="text-xs text-[#6B9071] mb-5">
            Pilih kategori pesan di bawah ini. Pesanmu langsung memunculkan notifikasi di perangkat Admin kami!
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
                placeholder="Nomor WhatsApp (Agar Cepat Dibalas)"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Nomor Invoice (Jika Klaim Garansi)"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
            </div>

            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={
                msgType === 'KLAIM_GARANSI'
                  ? 'Tuliskan kendalamu (misal: Pembayaran QRIS selesai tapi file belum masuk ke email)...'
                  : 'Jelaskan detail website sederhana, template Excel, atau layanan kustom yang ingin kamu buat...'
              }
              className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
            />

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
                  <span>Mengirim Pesan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E3EED4]" />
                  <span>Kirim Pesan Sekarang</span>
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