'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Mail,
  TicketPercent,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Download,
  RefreshCw,
} from 'lucide-react';
import { CartItem, Order } from '@/types';
import {
  CART_STORAGE_KEY,
  parseThumbnails,
  formatRupiah,
} from '@/components/storefront/StorefrontTypes';

interface PromoCheckResult {
  valid: boolean;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  message: string;
}

interface PromoFeedback {
  type: 'success' | 'error';
  text: string;
}

interface CheckoutApiResponse {
  order?: Order;
  simulation_mode?: boolean;
  error?: string;
}

type NullablePromo = PromoCheckResult | null;
type NullableFeedback = PromoFeedback | null;
type NullableString = string | null;
type NullableOrder = Order | null;

function checkClientEmailFormat(raw: string): {
  valid: boolean;
  errorText: string;
} {
  const email = raw.trim().toLowerCase();
  if (!email) {
    return {
      valid: false,
      errorText: 'Alamat email penerima wajib diisi terlebih dahulu.',
    };
  }
  if (email.includes(' ')) {
    return {
      valid: false,
      errorText: 'Alamat email tidak boleh mengandung spasi.',
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0]) {
    return {
      valid: false,
      errorText:
        'Format email belum lengkap (harus menyertakan tanda "@", contoh: nama@email.com).',
    };
  }

  const domain = parts[1];
  if (
    !domain ||
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.startsWith('-') ||
    domain.endsWith('-') ||
    domain.includes('..')
  ) {
    return {
      valid: false,
      errorText:
        'Penulisan domain setelah tanda "@" belum benar (contoh: @gmail.com, @yahoo.com, @outlook.com).',
    };
  }

  const domainSegments = domain.split('.');
  const tld = domainSegments[domainSegments.length - 1];
  if (!tld || tld.length < 2) {
    return {
      valid: false,
      errorText:
        'Akhiran domain email setelah tanda "@" kurang lengkap (contoh: .com, .id, .co.id).',
    };
  }

  return { valid: true, errorText: '' };
}

/**
 * Cadangan pop-up pembayaran jika URL pembayaran berupa link halaman (http/https).
 * Jika Direct API QRIS sudah aktif, kode barcode langsung tampil di halaman RizzFlow sendiri.
 */
function openPaymentPopupOverlay(paymentUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const win = window as unknown as {
      loadJokulCheckout?: (url: string) => void;
    };

    if (typeof win.loadJokulCheckout === 'function') {
      win.loadJokulCheckout(paymentUrl);
      resolve(true);
      return;
    }

    const isSandbox = paymentUrl.includes('sandbox');
    const scriptSrc = isSandbox
      ? 'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js'
      : 'https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';

    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existing) {
      setTimeout(() => {
        if (typeof win.loadJokulCheckout === 'function') {
          win.loadJokulCheckout(paymentUrl);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 400);
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      if (typeof win.loadJokulCheckout === 'function') {
        win.loadJokulCheckout(paymentUrl);
        resolve(true);
      } else {
        resolve(false);
      }
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function CheckoutPage() {
  const qrisBoxRef = useRef(null as HTMLDivElement | null);
  const hasAutoOpenedPopupRef = useRef(false);

  const [cart, setCart] = useState([] as CartItem[]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [customerEmail, setCustomerEmail] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null as NullablePromo);
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState(null as NullableFeedback);

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null as NullableString);
  const [activeOrder, setActiveOrder] = useState(null as NullableOrder);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [isCheckingStatusNow, setIsCheckingStatusNow] = useState(false);
  const [isDownloadingQris, setIsDownloadingQris] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);

  // Fungsi pengecekan status pesanan langsung ke server backend
  const fetchOrderStatus = useCallback(async (invoiceNumber: string) => {
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(invoiceNumber)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = (await res.json()) as { order?: Order };
        if (data.order) {
          setActiveOrder(data.order);
          if (data.order.payment_status === 'PAID') {
            localStorage.removeItem(CART_STORAGE_KEY);
            setCart([]);
          }
          return data.order;
        }
      }
    } catch {
      // Abaikan gangguan jaringan sementara
    }
    return null;
  }, []);

  // Muat keranjang & cek apakah URL membawa ?invoice=INV-...
  useEffect(() => {
    const init = async () => {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CartItem[];
          if (Array.isArray(parsed)) {
            setCart(parsed);
          }
        }

        const params = new URLSearchParams(window.location.search);
        const invoiceFromUrl = (params.get('invoice') || '').trim();
        if (invoiceFromUrl) {
          await fetchOrderStatus(invoiceFromUrl);
        }
      } catch (e) {
        console.error('Gagal memuat checkout:', e);
      } finally {
        setIsLoaded(true);
      }
    };

    init();
  }, [fetchOrderStatus]);

  const subtotalAmount = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const discountAmount =
    appliedPromo && appliedPromo.valid ? appliedPromo.discount_amount : 0;
  const finalAmount = Math.max(0, subtotalAmount - discountAmount);
  const hasDiscount = discountAmount !== 0;

  // Hitung mundur kedaluwarsa QRIS
  useEffect(() => {
    if (!activeOrder || activeOrder.payment_status !== 'PENDING') return;

    const updateTimer = () => {
      if (!activeOrder.qris_expires_at) return;
      const expiresMs = new Date(activeOrder.qris_expires_at).getTime();
      const diffSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [activeOrder]);

  // Jika URL pembayaran berupa link http (fallback), buka pop-up otomatis di atas halaman ini
  useEffect(() => {
    if (
      activeOrder &&
      activeOrder.payment_status === 'PENDING' &&
      activeOrder.qris_string &&
      activeOrder.qris_string.startsWith('http') &&
      !hasAutoOpenedPopupRef.current
    ) {
      hasAutoOpenedPopupRef.current = true;
      openPaymentPopupOverlay(activeOrder.qris_string);
    }
  }, [activeOrder]);

  // Polling otomatis setiap 4 detik untuk deteksi pembayaran lunas
  useEffect(() => {
    if (!activeOrder || activeOrder.payment_status !== 'PENDING') return;

    const pollId = setInterval(() => {
      fetchOrderStatus(activeOrder.invoice_number);
    }, 4000);

    return () => clearInterval(pollId);
  }, [activeOrder, fetchOrderStatus]);

  const handleManualCheckStatus = async () => {
    if (!activeOrder) return;
    setIsCheckingStatusNow(true);
    await fetchOrderStatus(activeOrder.invoice_number);
    setIsCheckingStatusNow(false);
  };

  const handleValidatePromo = async () => {
    const cleanCode = promoInput.trim().toUpperCase();
    if (!cleanCode) {
      setAppliedPromo(null);
      setAppliedPromoCode('');
      setPromoMessage(null);
      return;
    }

    setIsValidatingPromo(true);
    setPromoMessage(null);
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          subtotal: subtotalAmount,
        }),
      });

      const data = (await res.json()) as PromoCheckResult;
      if (data.valid) {
        setAppliedPromo(data);
        setAppliedPromoCode(cleanCode);
        setPromoMessage({ type: 'success', text: data.message });
      } else {
        setAppliedPromo(null);
        setAppliedPromoCode('');
        setPromoMessage({ type: 'error', text: data.message });
      }
    } catch {
      setPromoMessage({
        type: 'error',
        text: 'Gagal memeriksa kode promo. Coba lagi.',
      });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleCreateCheckoutOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setCheckoutError(null);

    const emailValidation = checkClientEmailFormat(customerEmail);
    if (!emailValidation.valid) {
      setCheckoutError(emailValidation.errorText);
      return;
    }

    setIsCreatingOrder(true);
    hasAutoOpenedPopupRef.current = false;

    try {
      const promoToUse =
        appliedPromo && appliedPromo.valid
          ? appliedPromoCode
          : promoInput.trim()
          ? promoInput.trim().toUpperCase()
          : null;

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail.trim().toLowerCase(),
          promo_code: promoToUse,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await res.json()) as CheckoutApiResponse;
      if (!res.ok || !data.order) {
        throw new Error(data.error || 'Gagal menyiapkan kode pembayaran QRIS.');
      }

      setActiveOrder(data.order);
      setIsSimulationMode(Boolean(data.simulation_mode));

      if (data.order.payment_status === 'PAID') {
        localStorage.removeItem(CART_STORAGE_KEY);
        setCart([]);
      } else {
        const nextUrl = `/checkout?invoice=${encodeURIComponent(
          data.order.invoice_number
        )}`;
        window.history.replaceState(null, '', nextUrl);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat checkout.'
      );
    } finally {
      setIsCreatingOrder(false);
    }
  };

  /**
   * Menyimpan kode QRIS sebagai gambar PNG tajam berlatar putih
   * agar langsung terbaca saat diunggah ke galeri GoPay, DANA, OVO, ShopeePay, dan M-Banking.
   */
  const handleDownloadQrisImage = () => {
    if (!activeOrder || !qrisBoxRef.current) return;
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
          ctx.fillText('RizzFlow — QRIS Pembayaran', width / 2, 50);

          ctx.fillStyle = '#E3EED4';
          ctx.font = 'bold 17px sans-serif';
          ctx.fillText(`Invoice #${activeOrder.invoice_number}`, width / 2, 84);

          const qrSize = 430;
          const qrX = (width - qrSize) / 2;
          const qrY = 152;
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

          ctx.fillStyle = '#375534';
          ctx.font = 'bold 19px sans-serif';
          ctx.fillText('Total Pembayaran:', width / 2, 640);

          ctx.fillStyle = '#0F2A1D';
          ctx.font = 'bold 38px sans-serif';
          ctx.fillText(formatRupiah(activeOrder.final_amount), width / 2, 692);

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
          link.download = `QRIS-RizzFlow-${activeOrder.invoice_number}.png`;
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

  const handleSimulatePayment = async () => {
    if (!activeOrder) return;
    setIsSimulatingPayment(true);
    try {
      const payload = {
        order: {
          invoice_number: activeOrder.invoice_number,
          amount: activeOrder.final_amount,
        },
        transaction: {
          status: 'SUCCESS',
          date: new Date().toISOString(),
        },
      };

      const res = await fetch('/api/webhooks/doku', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': 'SIMULATION',
          'Request-Id': `REQ-${Date.now()}`,
          'Request-Timestamp': new Date().toISOString(),
          Signature: 'SIMULATION_BYPASS',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchOrderStatus(activeOrder.invoice_number);
      }
    } catch (e) {
      console.error('Gagal simulasi pembayaran:', e);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F6F8F3] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#375534]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8F3] text-[#0F2A1D] pb-16">
      <header className="bg-[#0F2A1D] text-[#E3EED4] rounded-b-[32px] py-5 px-4 shadow-md mb-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#375534]/80 hover:bg-[#375534] text-[#E3EED4] text-xs font-extrabold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Toko</span>
          </Link>

          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#AEC3B0]" />
            <span className="text-xs font-extrabold text-white">
              Checkout Resmi QRIS
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4">
        {activeOrder ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white rounded-[32px] border border-[#AEC3B0]/60 p-6 sm:p-8 rf-card-shadow text-center space-y-5"
          >
            {activeOrder.payment_status === 'PAID' ? (
              <div className="space-y-4 py-4">
                <div className="w-16 h-16 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center mx-auto border-2 border-[#375534]">
                  <CheckCircle2 className="w-9 h-9 text-[#375534]" />
                </div>
                <span className="inline-block px-3.5 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold">
                  Pembayaran Berhasil Diterima!
                </span>
                <h1 className="text-2xl font-extrabold text-[#0F2A1D]">
                  Terima Kasih Atas Pembelianmu
                </h1>
                <p className="text-xs sm:text-sm text-[#375534] leading-relaxed">
                  Link unduhan produk untuk pesanan{' '}
                  <strong className="text-[#0F2A1D]">
                    #{activeOrder.invoice_number}
                  </strong>{' '}
                  telah dikirimkan otomatis ke alamat email{' '}
                  <strong className="text-[#0F2A1D]">
                    {activeOrder.customer_email}
                  </strong>
                  .
                </p>
                <div className="pt-3">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm transition-colors"
                  >
                    Kembali ke Beranda Toko
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#AEC3B0]/40 pb-4">
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-[#6B9071] block">
                      Nomor Invoice
                    </span>
                    <span className="font-extrabold text-sm text-[#0F2A1D]">
                      #{activeOrder.invoice_number}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold">
                    <Clock className="w-3.5 h-3.5 text-[#375534]" />
                    <span>{formatCountdown(remainingSeconds)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#6B9071]">
                    Total Pembayaran QRIS
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#0F2A1D]">
                    {formatRupiah(activeOrder.final_amount)}
                  </div>
                  <p className="text-xs text-[#375534]">
                    Produk akan dikirim otomatis ke:{' '}
                    <strong>{activeOrder.customer_email}</strong>
                  </p>
                </div>

                {/* AREA TAMPILAN QRIS BERSIH DENGAN DESAIN RIZZFLOW SENDIRI */}
                <div className="w-full space-y-3">
                  {activeOrder.qris_string &&
                  activeOrder.qris_string.startsWith('http') ? (
                    <div className="p-6 rounded-[28px] bg-[#E3EED4]/55 border border-[#6B9071]/50 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center mx-auto shadow-sm">
                        <QrCode className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-sm sm:text-base font-extrabold text-[#0F2A1D]">
                          Kode QRIS Pembayaran Siap Dipindai
                        </h2>
                        <p className="text-xs text-[#375534] leading-relaxed">
                          Jendela kode QRIS tampil langsung di atas halaman ini. Jika jendela tertutup, tekan tombol di bawah untuk menampilkannya kembali.
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          if (activeOrder.qris_string) {
                            openPaymentPopupOverlay(activeOrder.qris_string);
                          }
                        }}
                        className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-md transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Tampilkan Kode QRIS &amp; Simpan</span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={isCheckingStatusNow}
                        onClick={handleManualCheckStatus}
                        className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        {isCheckingStatusNow ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Memverifikasi Pembayaran...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Saya Sudah Bayar — Cek Status Sekarang</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="p-5 rounded-[28px] bg-[#E3EED4]/60 border border-[#6B9071]/50 inline-flex flex-col items-center mx-auto gap-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-[11px] font-extrabold">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QRIS Pembayaran Resmi</span>
                        </div>

                        <div
                          ref={qrisBoxRef}
                          className="bg-white p-4 rounded-2xl border border-[#AEC3B0]/70 shadow-xs"
                        >
                          {activeOrder.qris_string ? (
                            React.createElement(QRCodeSVG, {
                              value: activeOrder.qris_string,
                              size: 225,
                            })
                          ) : (
                            <div className="w-48 h-48 flex items-center justify-center text-xs text-[#6B9071]">
                              QRIS tidak tersedia
                            </div>
                          )}
                        </div>

                        <span className="text-[11px] font-bold text-[#375534]">
                          Scan dengan GoPay, DANA, OVO, ShopeePay &amp; M-Banking
                        </span>
                      </div>

                      {activeOrder.qris_string && (
                        <div className="space-y-2.5">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            disabled={isDownloadingQris}
                            onClick={handleDownloadQrisImage}
                            className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                          >
                            {isDownloadingQris ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Menyiapkan Gambar QRIS...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>Simpan Gambar QRIS (.PNG)</span>
                              </>
                            )}
                          </motion.button>

                          {!isSimulationMode && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              disabled={isCheckingStatusNow}
                              onClick={handleManualCheckStatus}
                              className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071] font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors"
                            >
                              {isCheckingStatusNow ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Memverifikasi Pembayaran...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Saya Sudah Bayar — Cek Status Sekarang</span>
                                </>
                              )}
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#6B9071] max-w-sm mx-auto leading-relaxed">
                  Setelah selesai membayar via GoPay, DANA, OVO, ShopeePay, atau M-Banking, halaman ini otomatis memperbarui status menjadi Lunas dan mengirim file ke emailmu.
                </p>

                {isSimulationMode && (
                  <div className="pt-2 border-t border-[#AEC3B0]/40">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={isSimulatingPayment}
                      onClick={handleSimulatePayment}
                      className="w-full py-3.5 px-5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                    >
                      {isSimulatingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi Pembayaran &amp; Mengirim Email...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-[#E3EED4]" />
                          <span>Simulasikan Pembayaran QRIS Berhasil</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : cart.length === 0 ? (
          <div className="max-w-md mx-auto bg-white rounded-[32px] border border-[#AEC3B0]/50 p-8 text-center rf-card-shadow space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-extrabold text-[#0F2A1D]">
              Keranjang Belanja Kosong
            </h1>
            <p className="text-xs text-[#6B9071]">
              Silakan pilih produk digital dari katalog terlebih dahulu sebelum menuju halaman Checkout.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold"
            >
              Jelajahi Katalog Produk
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white rounded-[28px] border border-[#AEC3B0]/50 p-6 rf-card-shadow space-y-4">
              <h1 className="text-lg font-extrabold text-[#0F2A1D]">
                Ringkasan Produk ({cart.length} Item)
              </h1>

              <div className="space-y-3">
                {cart.map((item) => {
                  const thumb =
                    parseThumbnails(item.product.thumbnail_url)[0] ||
                    item.product.thumbnail_url;
                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50"
                    >
                      <img
                        src={thumb}
                        alt={item.product.title}
                        className="w-16 h-16 rounded-xl object-cover bg-[#E3EED4] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] truncate">
                          {item.product.title}
                        </h3>
                        <p className="text-xs text-[#6B9071] mt-0.5">
                          Jumlah: {item.quantity} x{' '}
                          {formatRupiah(item.product.price)}
                        </p>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] shrink-0">
                        {formatRupiah(item.product.price * item.quantity)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleCreateCheckoutOrder}
              noValidate
              className="lg:col-span-5 bg-white rounded-[28px] border border-[#AEC3B0]/50 p-6 rf-card-shadow space-y-5"
            >
              <div>
                <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                  Detail Pengiriman &amp; Pembayaran
                </h2>
                <p className="text-xs text-[#6B9071] mt-0.5">
                  Lengkapi alamat email aktifmu di bawah ini untuk melanjutkan ke pembayaran QRIS.
                </p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                  Alamat Email Penerima File *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B9071] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      if (checkoutError) setCheckoutError(null);
                    }}
                    placeholder="Contoh: nama@email.com"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 text-xs sm:text-sm text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                  />
                </div>
                <p className="text-[11px] text-[#375534] mt-1.5 leading-relaxed">
                  * Pastikan penulisan alamat email dan domain setelah tanda &ldquo;@&rdquo; sudah benar (mendukung Gmail, Yahoo, Outlook, dll.) karena file produk dikirim otomatis ke email ini.
                </p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                  Kode Promo Diskon (Opsional — Kosongkan Jika Tidak Ada)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <TicketPercent className="w-4 h-4 text-[#6B9071] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required={false}
                      value={promoInput}
                      onChange={(e) =>
                        setPromoInput(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (promoInput.trim()) {
                            handleValidatePromo();
                          }
                        }
                      }}
                      placeholder="Kosongkan jika tidak pakai promo"
                      className="w-full pl-10 pr-3 py-3 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 text-xs font-bold uppercase text-[#0F2A1D] placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-[#375534]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isValidatingPromo || !promoInput.trim()}
                    onClick={handleValidatePromo}
                    className="px-4 py-3 rounded-2xl bg-[#E3EED4] hover:bg-[#375534] disabled:opacity-50 text-[#0F2A1D] hover:text-white text-xs font-extrabold transition-colors shrink-0"
                  >
                    {isValidatingPromo ? 'Cek...' : 'Pakai'}
                  </button>
                </div>

                {promoMessage && (
                  <p
                    className={
                      promoMessage.type === 'success'
                        ? 'text-xs font-bold text-[#375534] mt-2'
                        : 'text-xs font-bold text-red-600 mt-2'
                    }
                  >
                    {promoMessage.text}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 space-y-2 text-xs">
                <div className="flex justify-between text-[#375534]">
                  <span>Subtotal Produk</span>
                  <span className="font-bold">
                    {formatRupiah(subtotalAmount)}
                  </span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-[#375534] font-bold">
                    <span>Potongan Promo ({appliedPromoCode})</span>
                    <span>-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-[#AEC3B0]/50 pt-2 flex justify-between items-baseline text-sm font-extrabold text-[#0F2A1D]">
                  <span>Total Bayar</span>
                  <span className="text-lg">
                    {finalAmount === 0
                      ? 'Gratis (Rp0)'
                      : formatRupiah(finalAmount)}
                  </span>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                disabled={isCreatingOrder}
                className="w-full py-4 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                {isCreatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {finalAmount === 0
                        ? 'Mengirim Produk Gratis...'
                        : 'Menyiapkan Kode QRIS...'}
                    </span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 text-[#E3EED4]" />
                    <span>
                      {finalAmount === 0
                        ? 'Klaim Produk Gratis Sekarang (Rp0)'
                        : `Lanjut Pembayaran QRIS (${formatRupiah(finalAmount)})`}
                    </span>
                  </>
                )}
              </motion.button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}