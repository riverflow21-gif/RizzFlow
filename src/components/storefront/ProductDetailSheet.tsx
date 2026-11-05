'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  ShoppingBag,
  Zap,
  QrCode,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Product } from '@/types';
import { getProductCardInfo, formatRupiah, LOGO_PATH } from './StorefrontTypes';

type DetailSubTab = 'deskripsi' | 'akses' | 'garansi';

interface ProductDetailSheetProps {
  product: Product | null;
  storeName: string;
  onClose: () => void;
  onAddWithQuantity: (product: Product, quantity: number) => void;
}

export default function ProductDetailSheet({
  product,
  storeName,
  onClose,
  onAddWithQuantity,
}: ProductDetailSheetProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [detailTab, setDetailTab] = useState('deskripsi' as DetailSubTab);

  useEffect(() => {
    if (product) {
      setActiveImageIndex(0);
      setQuantity(1);
      setDetailTab('deskripsi');
    }
  }, [product]);

  if (!product) return null;

  const info = getProductCardInfo(product);
  const images = info.thumbList.length > 0 ? info.thumbList : [LOGO_PATH];
  const totalPrice = product.price * quantity;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[#0F2A1D]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-[#F6F8F3] w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl h-[68vh] sm:h-[76vh] flex flex-col touch-auto border border-[#AEC3B0]/50"
        >
          {/* Bar Atas Lembaran Detail */}
          <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between bg-[#F6F8F3] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/50 flex items-center justify-center shadow-xs transition-colors"
              aria-label="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="font-extrabold text-sm text-[#0F2A1D]">
              Detail Produk
            </span>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/50 flex items-center justify-center shadow-xs transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ================================================================ */}
          {/* SATU WADAH SCROLL TERPADU: GAMBAR IKUT TER-SCROLL KE ATAS */}
          {/* ================================================================ */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 space-y-5">
            <div className="space-y-2.5">
              <div className="relative aspect-[16/11] rounded-[24px] bg-[#E3EED4] overflow-hidden border border-[#AEC3B0]/50 shadow-xs">
                <img
                  src={images[activeImageIndex] || images[0]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />

                {info.hasDiscount && info.savePercent > 0 && (
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs">
                    Hemat {info.savePercent}%
                  </span>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev === 0 ? images.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F2A1D] flex items-center justify-center shadow-md"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev === images.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F2A1D] flex items-center justify-center shadow-md"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={
                        activeImageIndex === idx
                          ? 'w-6 h-2 rounded-full bg-[#0F2A1D] transition-all'
                          : 'w-2 h-2 rounded-full bg-[#AEC3B0] transition-all'
                      }
                      aria-label={`Gambar ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              {product.badge && (
                <span className="inline-block px-3 py-0.5 rounded-full bg-[#E3EED4] text-[#375534] text-xs font-extrabold">
                  {product.badge}
                </span>
              )}
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2A1D] leading-snug break-words">
                {product.title}
              </h2>
            </div>

            {/* Baris Info Toko Official + Pengatur Jumlah [- 1 +] */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#AEC3B0]/40 flex items-center justify-between gap-3 rf-card-shadow">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={LOGO_PATH}
                  alt={storeName}
                  className="w-9 h-9 rounded-xl object-contain bg-[#F6F8F3] p-0.5 border border-[#AEC3B0]/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-xs text-[#0F2A1D] truncate">
                      {storeName} Official
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#375534] shrink-0" />
                  </div>
                  <span className="block text-[11px] text-[#6B9071] truncate">
                    Pengiriman Instan • Bergaransi
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2.5 bg-[#E3EED4]/70 border border-[#AEC3B0]/60 rounded-full px-2.5 py-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-6 h-6 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center font-bold shadow-2xs"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-extrabold text-[#0F2A1D] w-4 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-6 h-6 rounded-full bg-[#0F2A1D] text-white flex items-center justify-center font-bold shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 3 Tab Informasi di Dalam Detail */}
            <div className="space-y-3">
              <div className="flex items-center gap-5 border-b border-[#AEC3B0]/50">
                <button
                  type="button"
                  onClick={() => setDetailTab('deskripsi')}
                  className={
                    detailTab === 'deskripsi'
                      ? 'pb-2 text-xs font-extrabold text-[#0F2A1D] border-b-2 border-[#0F2A1D]'
                      : 'pb-2 text-xs font-bold text-[#6B9071] hover:text-[#0F2A1D]'
                  }
                >
                  Deskripsi
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('akses')}
                  className={
                    detailTab === 'akses'
                      ? 'pb-2 text-xs font-extrabold text-[#0F2A1D] border-b-2 border-[#0F2A1D]'
                      : 'pb-2 text-xs font-bold text-[#6B9071] hover:text-[#0F2A1D]'
                  }
                >
                  Cara Akses
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('garansi')}
                  className={
                    detailTab === 'garansi'
                      ? 'pb-2 text-xs font-extrabold text-[#0F2A1D] border-b-2 border-[#0F2A1D]'
                      : 'pb-2 text-xs font-bold text-[#6B9071] hover:text-[#0F2A1D]'
                  }
                >
                  Jaminan Garansi
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/35 text-xs sm:text-sm text-[#0F2A1D] leading-relaxed">
                {detailTab === 'deskripsi' && (
                  <p className="whitespace-pre-line break-words">
                    {product.description}
                  </p>
                )}

                {detailTab === 'akses' && (
                  <div className="space-y-2 text-xs text-[#375534]">
                    <p className="font-extrabold text-[#0F2A1D]">
                      ⚡ Pengiriman File Otomatis Detik Itu Juga:
                    </p>
                    <p>
                      Masukkan produk ini ke keranjang, isi alamat email aktifmu di halaman Checkout, lalu pindai kode QRIS. Begitu pembayaran terdeteksi lunas, link unduhan produk langsung terkirim otomatis ke kotak masuk emailmu!
                    </p>
                  </div>
                )}

                {detailTab === 'garansi' && (
                  <div className="space-y-1.5 text-xs text-[#375534]">
                    <p className="font-extrabold text-[#0F2A1D]">
                      🛡️ Garansi Resmi 100% {storeName}:
                    </p>
                    <p>
                      Seluruh produk digital yang kamu beli dijamin dapat diakses dan sesuai deskripsi. Jika terdapat kendala pengiriman email atau file, kamu dapat langsung mengisi Canvas Klaim Garansi di menu <strong>Layanan</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4 Lingkaran Keunggulan di Bawah Deskripsi */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-[#E3EED4] text-[#375534] flex items-center justify-center mb-1.5">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#0F2A1D] leading-tight">
                  Akses Instan
                </span>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-[#E3EED4] text-[#375534] flex items-center justify-center mb-1.5">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#0F2A1D] leading-tight">
                  QRIS Resmi
                </span>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-[#E3EED4] text-[#375534] flex items-center justify-center mb-1.5">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#0F2A1D] leading-tight">
                  Tanpa Akun
                </span>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-[#E3EED4] text-[#375534] flex items-center justify-center mb-1.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#0F2A1D] leading-tight">
                  Garansi 100%
                </span>
              </div>
            </div>
          </div>

          {/* STICKY CAPSULE BOTTOM BAR */}
          <div className="p-4 sm:px-6 bg-white border-t border-[#AEC3B0]/40 flex items-center justify-between gap-4 shrink-0">
            <div>
              <span className="block text-[11px] font-semibold text-[#6B9071]">
                Total Harga
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-extrabold text-[#0F2A1D]">
                  {formatRupiah(totalPrice)}
                </span>
                {info.hasDiscount && info.origPrice && (
                  <span className="text-xs text-[#6B9071] line-through">
                    {formatRupiah(info.origPrice * quantity)}
                  </span>
                )}
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onAddWithQuantity(product, quantity)}
              className="px-6 py-3.5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-md transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-[#E3EED4]" />
              <span>Tambah ke Keranjang</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}