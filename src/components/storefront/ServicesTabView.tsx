'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ExternalLink,
  Download,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  CustomServiceConfig,
  CustomProjectOrder,
  DeliveryLinkItem,
  formatRupiah,
} from './StorefrontTypes';

interface ServicesTabViewProps {
  customService: CustomServiceConfig;
  storeName: string;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

type SupportCategoryType = 'KLAIM_GARANSI' | 'PERTANYAAN';

interface FeedbackState {
  type: 'success' | 'error';
  text: string;
}

type NullableFeedback = FeedbackState | null;
type NullableNumber = number | null;
type NullableCustomOrder = CustomProjectOrder | null;
type NullableString = string | null;

const SERVICE_FAQ_ITEMS = [
  {
    q: 'Bagaimana alur pemesanan dan pembayaran Layanan Kustom?',
    a: 'Pilih jenis layanan yang kamu butuhkan lalu klik tombol Diskusi via WhatsApp atau Telegram untuk membahas detail dan harga langsung bersama Admin. Setelah selesai dikerjakan, Admin akan mengirim link pembayaran QRIS resmi ke chat kamu. Begitu dibayar, file produkmu langsung terbuka otomatis untuk diunduh.',
  },
  {
    q: 'Bagaimana cara menerima file produk digital instan setelah bayar QRIS?',
    a: 'Begitu kamu selesai memindai dan membayar kode QRIS, sistem otomatis RizzFlow mendeteksi pembayaranmu dan langsung mengirimkan link unduhan produk ke alamat email yang kamu isi saat Checkout.',
  },
  {
    q: 'Apakah saya harus membuat akun atau login terlebih dahulu?',
    a: 'Tidak perlu! Di RizzFlow kamu bisa langsung berbelanja produk instan maupun membayar tagihan layanan kustom tanpa perlu mendaftar akun.',
  },
  {
    q: 'Bagaimana jika email produk belum masuk atau ada kendala file?',
    a: 'Periksa tab Promosi atau folder Spam di aplikasi email kamu. Jika masih belum ditemukan, gunakan formulir Klaim Garansi di halaman ini atau hubungi langsung Admin lewat WhatsApp/Telegram agar segera dibantu.',
  },
];

export default function ServicesTabView({
  customService,
  storeName,
  whatsappUrl,
  telegramUrl,
}: ServicesTabViewProps) {
  const qrisBoxRef = useRef(null as HTMLDivElement | null);
  const isPollingRef = useRef(false);

  // Area Pembayaran Transaksi Kustom (Tersembunyi secara default, terbuka otomatis lewat link Admin)
  const [showManualBillInput, setShowManualBillInput] = useState(false);
  const [orderCodeInput, setOrderCodeInput] = useState('');
  const [checkedOrder, setCheckedOrder] = useState(
    null as NullableCustomOrder
  );
  const [unlockedFiles, setUnlockedFiles] = useState(
    [] as DeliveryLinkItem[]
  );
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isProcessingBill, setIsProcessingBill] = useState(false);
  const [isVerifyingBill, setIsVerifyingBill] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState(null as NullableString);
  const [isDownloadingQris, setIsDownloadingQris] = useState(false);
  const [isSimMode, setIsSimMode] = useState(false);
  const [checkError, setCheckError] = useState(null as NullableString);

  // State Pilihan Layanan Kustom (Diskusi Langsung WA / Telegram)
  const [selectedServiceName, setSelectedServiceName] = useState(
    customService.services[0] || 'Layanan Pembuatan Digital Kustom'
  );
  const [customBriefNote, setCustomBriefNote] = useState('');

  // State Formulir Klaim Garansi & Tanya Admin
  const [msgType, setMsgType] = useState(
    'KLAIM_GARANSI' as SupportCategoryType
  );
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null as NullableFeedback);
  const [openFaqIndex, setOpenFaqIndex] = useState(0 as NullableNumber);

  const buildDynamicWaUrl = (customText: string): NullableString => {
    const rawWa = customService.admin_whatsapp || '';
    const digits = rawWa.replace(/[^0-9]/g, '');
    if (digits) {
      const formatted = digits.startsWith('0')
        ? '62' + digits.slice(1)
        : digits;
      return `https://wa.me/${formatted}?text=${encodeURIComponent(customText)}`;
    }
    return whatsappUrl;
  };

  const buildDynamicTgUrl = (customText: string): NullableString => {
    if (!telegramUrl) return null;
    const base = telegramUrl.split('?')[0];
    return `${base}?text=${encodeURIComponent(customText)}`;
  };

  const fetchCustomOrderByCode = useCallback(
    async (rawInput: string, silent = false) => {
      const rawCode = rawInput.trim().toUpperCase();
      if (!rawCode) return null;

      const normalizedCode =
        rawCode.length === 4 && !rawCode.startsWith('KST-')
          ? `KST-${rawCode}`
          : rawCode;

      if (silent && isPollingRef.current) return null;
      if (silent) {
        isPollingRef.current = true;
      } else {
        setIsCheckingCode(true);
        setCheckError(null);
        setVerifyNotice(null);
      }

      try {
        const res = await fetch(
          `/api/messages?order_code=${encodeURIComponent(normalizedCode)}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const data = (await res.json()) as {
          customOrder?: CustomProjectOrder;
          unlockedFiles?: DeliveryLinkItem[];
          simulation_mode?: boolean;
          error?: string;
        };

        if (!res.ok || !data.customOrder) {
          if (!silent) {
            setCheckedOrder(null);
            setUnlockedFiles([]);
            throw new Error(
              data.error || `Kode Transaksi "${normalizedCode}" tidak ditemukan.`
            );
          }
          return null;
        }

        const latest = data.customOrder;
        setOrderCodeInput(latest.order_code);
        setCheckedOrder((prev) => {
          if (
            !silent ||
            !prev ||
            prev.id !== latest.id ||
            prev.status !== latest.status ||
            prev.payment_status !== latest.payment_status
          ) {
            return latest;
          }
          return prev;
        });

        if (data.unlockedFiles) {
          setUnlockedFiles(data.unlockedFiles);
        }
        setIsSimMode(Boolean(data.simulation_mode));
        if (latest.status === 'LUNAS') {
          setVerifyNotice(null);
        }
        return latest;
      } catch (err) {
        if (!silent) {
          setCheckError(
            err instanceof Error ? err.message : 'Gagal memeriksa transaksi.'
          );
        }
        return null;
      } finally {
        if (silent) {
          isPollingRef.current = false;
        } else {
          setIsCheckingCode(false);
        }
      }
    },
    []
  );

  // Otomatis membuka tagihan jika pelanggan datang dari link WA/Telegram (?kode=KST-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = (params.get('kode') || params.get('code') || '').trim();
    if (codeFromUrl) {
      setOrderCodeInput(codeFromUrl.toUpperCase());
      fetchCustomOrderByCode(codeFromUrl, false);
    }
  }, [fetchCustomOrderByCode]);

  // Verifikasi Otomatis tiap 3 detik + cek instan saat kembali dari GoPay/DANA/M-Banking
  const activeCode = checkedOrder?.order_code || '';
  const isWaitingPayment =
    checkedOrder?.status === 'SIAP_DIBAYAR' &&
    checkedOrder?.payment_status === 'PENDING';

  useEffect(() => {
    if (!activeCode || !isWaitingPayment) return;

    const triggerInstant = () => {
      if (document.visibilityState === 'visible') {
        fetchCustomOrderByCode(activeCode, true);
      }
    };

    const pollId = setInterval(() => {
      fetchCustomOrderByCode(activeCode, true);
    }, 3000);

    document.addEventListener('visibilitychange', triggerInstant);
    window.addEventListener('focus', triggerInstant);
    window.addEventListener('online', triggerInstant);

    return () => {
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', triggerInstant);
      window.removeEventListener('focus', triggerInstant);
      window.removeEventListener('online', triggerInstant);
    };
  }, [activeCode, isWaitingPayment, fetchCustomOrderByCode]);

  const handleCheckFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomOrderByCode(orderCodeInput, false);
  };

  const handleGenerateCustomQris = async (orderCode: string) => {
    setIsProcessingBill(true);
    setCheckError(null);
    setVerifyNotice(null);
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

  const handleManualVerifyCustomBill = async () => {
    if (!checkedOrder) return;
    setIsVerifyingBill(true);
    setVerifyNotice(null);

    const updated = await fetchCustomOrderByCode(
      checkedOrder.order_code,
      false
    );
    if (!updated || updated.status !== 'LUNAS') {
      setVerifyNotice(
        'Pembayaran belum terdeteksi dari bank/e-wallet. Jika baru saja membayar, tunggu beberapa detik lalu tekan lagi.'
      );
    }
    setIsVerifyingBill(false);
  };

  const handleConfirmCustomPaymentSim = async (orderCode: string) => {
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

  const handleDownloadCustomQris = () => {
    if (!checkedOrder || !qrisBoxRef.current) return;
    const svgEl = qrisBoxRef.current.querySelector('svg');
    if (!svgEl) return;

    setIsDownloadingQris(true);
    try {
      const serializer = new XMLSerializer();
      let svgText = serializer.serializeToString(svgEl);
      if (!svgText.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgText = svgText.replace(
          '<svg',
          '<svg xmlns="http://www.w3.org/2000/svg"'
        );
      }

      const svgBlob = new Blob([svgText], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const blobUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const width = 640;
        const height = 800;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = '#0F2A1D';
          ctx.fillRect(0, 0, width, 112);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${storeName} — QRIS Layanan Kustom`, width / 2, 50);

          ctx.fillStyle = '#E3EED4';
          ctx.font = 'bold 17px sans-serif';
          ctx.fillText(`Kode Transaksi: ${checkedOrder.order_code}`, width / 2, 84);

          const qrSize = 430;
          const qrX = (width - qrSize) / 2;
          const qrY = 152;
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

          ctx.fillStyle = '#375534';
          ctx.font = 'bold 19px sans-serif';
          ctx.fillText('Total Tagihan:', width / 2, 640);

          ctx.fillStyle = '#0F2A1D';
          ctx.font = 'bold 38px sans-serif';
          ctx.fillText(formatRupiah(checkedOrder.price), width / 2, 692);

          ctx.fillStyle = '#6B9071';
          ctx.font = '16px sans-serif';
          ctx.fillText(
            'Scan via GoPay, DANA, OVO, ShopeePay, atau M-Banking',
            width / 2,
            748
          );

          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `QRIS-Kustom-${checkedOrder.order_code}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        URL.revokeObjectURL(blobUrl);
        setIsDownloadingQris(false);
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setIsDownloadingQris(false);
      };

      img.src = blobUrl;
    } catch {
      setIsDownloadingQris(false);
    }
  };

  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
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
          invoice_number: msgType === 'KLAIM_GARANSI' ? invoiceNumber : '',
          message: messageText,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        error?: string;
      };
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

  const customChatText =
    `Halo Admin ${storeName}, saya ingin memesan layanan kustom "${selectedServiceName}".` +
    (customBriefNote.trim()
      ? `\n\nRincian kebutuhan saya:\n${customBriefNote.trim()}`
      : ' Boleh kita diskusikan detail dan estimasi biayanya?');

  const customWaLink = buildDynamicWaUrl(customChatText);
  const customTgLink = buildDynamicTgUrl(customChatText);

  const supportChatText =
    msgType === 'KLAIM_GARANSI'
      ? `Halo Admin ${storeName}, saya ingin mengajukan Klaim Garansi pesanan${invoiceNumber ? ` (${invoiceNumber})` : ''}.`
      : `Halo Admin ${storeName}, saya ingin bertanya mengenai produk/layanan di website.`;

  const supportWaLink = buildDynamicWaUrl(supportChatText);
  const supportTgLink = buildDynamicTgUrl(supportChatText);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-5 pb-12 space-y-7">
      {/* ==================================================================== */}
      {/* KARTU TRANSAKSI KUSTOM (OTOMATIS MUNCUL SAAT KLIK LINK DARI ADMIN) */}
      {/* ==================================================================== */}
      {checkedOrder && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] bg-white border-2 border-[#0F2A1D] p-6 sm:p-7 rf-card-shadow space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#AEC3B0]/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold tracking-wider">
                  {checkedOrder.order_code}
                </span>
                <span className="text-xs font-bold text-[#6B9071]">
                  Klien: {checkedOrder.customer_name}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2A1D] mt-1.5">
                {checkedOrder.project_title}
              </h2>
            </div>

            <div className="self-start sm:self-center">
              {checkedOrder.status === 'SIAP_DIBAYAR' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#375534] text-white text-xs font-extrabold">
                  <QrCode className="w-3.5 h-3.5 text-[#E3EED4]" />
                  <span>Siap Dibayar via QRIS</span>
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
            {checkedOrder.admin_note && (
              <p>
                <strong className="text-[#375534]">Keterangan Admin:</strong>{' '}
                {checkedOrder.admin_note}
              </p>
            )}
            <p className="text-base sm:text-lg font-extrabold text-[#0F2A1D] pt-1">
              Total Tagihan:{' '}
              <span className="text-[#375534]">
                {formatRupiah(checkedOrder.price)}
              </span>
            </p>
          </div>

          {checkedOrder.status === 'SIAP_DIBAYAR' && (
            <div className="space-y-4">
              {!checkedOrder.qris_string ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={isProcessingBill}
                  onClick={() =>
                    handleGenerateCustomQris(checkedOrder.order_code)
                  }
                  className="w-full py-4 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  {isProcessingBill ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyiapkan Kode QRIS Tagihan...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 text-[#E3EED4]" />
                      <span>
                        Bayar Tagihan via QRIS ({formatRupiah(checkedOrder.price)})
                      </span>
                    </>
                  )}
                </motion.button>
              ) : (
                <div className="p-5 rounded-3xl bg-[#E3EED4]/55 border border-[#6B9071]/50 text-center space-y-4 max-w-md mx-auto">
                  <div className="px-3.5 py-2 rounded-2xl bg-white/80 border border-[#6B9071]/40 inline-flex items-center justify-center gap-2 text-[11px] font-bold text-[#0F2A1D]">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#375534] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F2A1D]" />
                    </span>
                    <span>
                      Verifikasi otomatis berjalan — file langsung terbuka setelah bayar
                    </span>
                  </div>

                  {checkedOrder.qris_string.startsWith('http') ? (
                    <a
                      href={checkedOrder.qris_string}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Buka Kode QRIS Pembayaran</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <>
                      <div
                        ref={qrisBoxRef}
                        className="bg-white p-4 rounded-2xl inline-block border border-[#AEC3B0] shadow-xs"
                      >
                        {React.createElement(QRCodeSVG, {
                          value: checkedOrder.qris_string,
                          size: 215,
                        })}
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={isDownloadingQris}
                        onClick={handleDownloadCustomQris}
                        className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isDownloadingQris ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menyiapkan Gambar QRIS...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Simpan Gambar QRIS</span>
                          </>
                        )}
                      </motion.button>
                    </>
                  )}

                  {!isSimMode && (
                    <div className="space-y-1.5 pt-1">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={isVerifyingBill}
                        onClick={handleManualVerifyCustomBill}
                        className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border-2 border-[#375534] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
                      >
                        {isVerifyingBill ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#375534]" />
                            <span>Memverifikasi Pembayaran...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 text-[#375534]" />
                            <span>Verifikasi Pembayaran</span>
                          </>
                        )}
                      </motion.button>
                      <p className="text-[11px] font-semibold text-[#375534]">
                        Tekan tombol ini untuk verifikasi pembayaran lebih cepat
                      </p>
                      {verifyNotice && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                          {verifyNotice}
                        </div>
                      )}
                    </div>
                  )}

                  {isSimMode && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={isProcessingBill}
                      onClick={() =>
                        handleConfirmCustomPaymentSim(checkedOrder.order_code)
                      }
                      className="w-full py-3 px-4 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2"
                    >
                      {isProcessingBill ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memproses Pelunasan...</span>
                        </>
                      ) : (
                        <span>✨ Simulasikan Pembayaran Tagihan Lunas</span>
                      )}
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          )}

          {checkedOrder.status === 'LUNAS' && (
            <div className="p-5 rounded-2xl bg-[#E3EED4] border-2 border-[#375534] space-y-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#0F2A1D]">
                🎉 Pembayaran Lunas! Berikut File &amp; Link Produk Kustom Kamu:
              </div>

              {unlockedFiles.length === 0 ? (
                <p className="text-xs text-[#375534]">
                  Pesanan kustom kamu telah lunas. Jika file belum tampil di sini, silakan hubungi Admin melalui WhatsApp/Telegram.
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
                        className="px-4 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0"
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
      {/* 1. PESAN LAYANAN KUSTOM (LANGSUNG DI ATAS — DISKUSI VIA CHAT) */}
      {/* ==================================================================== */}
      <section className="rounded-[32px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-8 border border-[#375534] shadow-lg relative overflow-hidden space-y-5">
        <div className="w-60 h-60 rounded-full bg-[#375534]/40 blur-3xl absolute -top-20 -right-12 pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#375534] text-[#E3EED4] text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Layanan Pembuatan Digital Kustom</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {customService.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#AEC3B0] leading-relaxed">
              {customService.description}
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#AEC3B0]">
              1. Pilih jenis layanan yang ingin dibuat:
            </p>
            <div className="flex flex-wrap gap-2">
              {customService.services.map((srv, idx) => {
                const isSelected = selectedServiceName === srv;
                return (
                  <motion.button
                    key={idx}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelectedServiceName(srv)}
                    className={
                      isSelected
                        ? 'px-4 py-2.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] border border-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs'
                        : 'px-4 py-2.5 rounded-full bg-[#375534]/60 hover:bg-[#375534] text-white border border-[#6B9071]/50 text-xs font-bold inline-flex items-center gap-1.5'
                    }
                  >
                    <Check
                      className={
                        isSelected
                          ? 'w-3.5 h-3.5 text-[#0F2A1D] shrink-0'
                          : 'w-3.5 h-3.5 text-[#AEC3B0] shrink-0'
                      }
                    />
                    <span>{srv}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#AEC3B0]">
              2. Jelaskan singkat kebutuhanmu (Opsional — otomatis masuk ke chat):
            </label>
            <textarea
              rows={2}
              value={customBriefNote}
              onChange={(e) => setCustomBriefNote(e.target.value)}
              placeholder={`Contoh: Saya butuh ${selectedServiceName} untuk keperluan tugas/bisnis, target selesai 2 hari...`}
              className="w-full px-4 py-3 rounded-2xl bg-[#375534]/55 border border-[#6B9071]/50 text-xs sm:text-sm text-white placeholder:text-[#AEC3B0]/80 focus:outline-none focus:border-[#E3EED4]"
            />
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#AEC3B0]">
              3. Diskusi &amp; deal harga langsung dengan Admin (Pembayaran QRIS dilakukan di website):
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {customWaLink && (
                <a
                  href={customWaLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3.5 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Diskusi via WhatsApp</span>
                </a>
              )}
              {customTgLink && (
                <a
                  href={customTgLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3.5 rounded-full bg-[#375534] hover:bg-[#496e45] text-white border border-[#AEC3B0]/40 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-2xs"
                >
                  <Send className="w-4 h-4 text-[#E3EED4]" />
                  <span>Diskusi via Telegram</span>
                </a>
              )}
            </div>
          </div>

          {/* Tautan Ringkas Pembuka Kolom Transaksi (Hanya jika klien ingin ketik kode manual) */}
          <div className="pt-3 border-t border-[#375534]">
            <button
              type="button"
              onClick={() => setShowManualBillInput((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#AEC3B0] hover:text-white transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                Sudah deal dengan Admin &amp; punya Kode Transaksi? Buka pembayaran di sini
              </span>
              <ChevronDown
                className={
                  showManualBillInput
                    ? 'w-3.5 h-3.5 rotate-180 transition-transform'
                    : 'w-3.5 h-3.5 transition-transform'
                }
              />
            </button>

            {showManualBillInput && (
              <div className="mt-3 space-y-2.5">
                <form
                  onSubmit={handleCheckFormSubmit}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#AEC3B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={orderCodeInput}
                      onChange={(e) =>
                        setOrderCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder="Masukkan Kode Transaksi (Contoh: KST-4829)"
                      className="w-full pl-11 pr-4 py-3 rounded-full bg-[#375534]/75 border border-[#6B9071]/60 text-xs sm:text-sm font-extrabold tracking-wider uppercase text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-[#AEC3B0] focus:outline-none focus:border-[#E3EED4]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCheckingCode || !orderCodeInput.trim()}
                    className="px-6 py-3 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] font-extrabold text-xs inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    {isCheckingCode ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Membuka...</span>
                      </>
                    ) : (
                      <span>Buka Tagihan</span>
                    )}
                  </button>
                </form>

                {checkError && (
                  <div className="p-3 rounded-2xl bg-red-950/80 border border-red-400/40 text-red-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                    <span>{checkError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. KLAIM GARANSI & TANYA ADMIN (FORMULIR WEB + JALUR CHAT LANGSUNG) */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-[#AEC3B0]/60 rounded-[28px] p-6 sm:p-7 rf-card-shadow space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-[#375534]" />
              <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                Klaim Garansi &amp; Tanya Admin
              </h2>
            </div>
            <p className="text-xs text-[#6B9071]">
              Kirim tiket langsung lewat formulir website di bawah ini, atau pilih jalur chat cepat jika butuh balasan lebih cepat.
            </p>
          </div>

          {(supportWaLink || supportTgLink) && (
            <div className="p-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-extrabold text-[#0F2A1D]">
                Butuh respon lebih cepat? Chat Admin langsung:
              </span>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {supportWaLink && (
                  <a
                    href={supportWaLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-[11px] font-extrabold inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {supportTgLink && (
                  <a
                    href={supportTgLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] text-[11px] font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSendSupportMessage} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-[#F6F8F3] p-1.5 rounded-full border border-[#AEC3B0]/50">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setMsgType('KLAIM_GARANSI')}
                className={
                  msgType === 'KLAIM_GARANSI'
                    ? 'py-2.5 px-3 rounded-full text-xs font-extrabold bg-[#0F2A1D] text-white'
                    : 'py-2.5 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D]'
                }
              >
                🛡️ Klaim Garansi
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setMsgType('PERTANYAAN')}
                className={
                  msgType === 'PERTANYAAN'
                    ? 'py-2.5 px-3 rounded-full text-xs font-extrabold bg-[#0F2A1D] text-white'
                    : 'py-2.5 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D]'
                }
              >
                💬 Tanya Admin
              </motion.button>
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
                placeholder="Alamat Email Aktif Kamu *"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Nomor WhatsApp / Telegram (Opsional)"
                className="w-full px-4 py-3 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-2xl text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
              />
              {msgType === 'KLAIM_GARANSI' && (
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Nomor Invoice / Kode KST (Opsional)"
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
                  ? 'Jelaskan kendalamu (misal: pembayaran QRIS sudah berhasil tapi link file belum diterima)...'
                  : 'Tuliskan pertanyaanmu untuk Admin di sini...'
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
              whileTap={{ scale: 0.96 }}
              disabled={isSending}
              className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim Pesan...</span>
                </>
              ) : (
                <>
                  <MessageSquarePlus className="w-4 h-4 text-[#E3EED4]" />
                  <span>
                    {msgType === 'KLAIM_GARANSI'
                      ? 'Kirim Klaim Garansi ke Admin'
                      : 'Kirim Pertanyaan ke Admin'}
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
            {SERVICE_FAQ_ITEMS.map((item, idx) => {
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