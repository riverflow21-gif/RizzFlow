'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Check,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  Images,
  Zap,
  QrCode,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { Category, Product, StoreSettings } from '@/types';
import {
  StorefrontTab,
  ShopFilterMode,
  CustomServiceConfig,
  OLD_DEFAULT_DESC,
  NEW_GENERAL_DESC,
  LOGO_PATH,
  getProductCardInfo,
  formatRupiah,
} from './StorefrontTypes';

interface FilterJumpParams {
  filterMode?: ShopFilterMode;
  categoryId?: string;
  search?: string;
}

interface HomeTabViewProps {
  products: Product[];
  categories: Category[];
  settings: StoreSettings;
  customService: CustomServiceConfig;
  addedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onNavigateTab: (tab: StorefrontTab) => void;
  onJumpToShopWithFilter: (params: FilterJumpParams) => void;
}

export default function HomeTabView({
  products,
  categories,
  settings,
  customService,
  addedProductId,
  onSelectProduct,
  onAddToCart,
  onNavigateTab,
  onJumpToShopWithFilter,
}: HomeTabViewProps) {
  const [quickSearch, setQuickSearch] = useState('');

  const bannerDescription =
    !settings.banner_description ||
    settings.banner_description === OLD_DEFAULT_DESC
      ? NEW_GENERAL_DESC
      : settings.banner_description;

  const featuredProducts = products.slice(0, 4);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJumpToShopWithFilter({ search: quickSearch.trim() });
  };

  return (
    <div className="space-y-7 pb-8">
      {/* ==================================================================== */}
      {/* BLOK ATAS HIJAU HUTAN GELAP (#0F2A1D) */}
      {/* ==================================================================== */}
      <section className="bg-[#0F2A1D] text-[#E3EED4] rounded-b-[36px] pt-5 pb-8 px-4 sm:px-8 relative overflow-hidden shadow-lg">
        <div className="w-64 h-64 rounded-full bg-[#375534]/40 blur-3xl absolute -top-20 -right-16 pointer-events-none" />
        <div className="w-52 h-52 rounded-full bg-[#6B9071]/20 blur-2xl absolute bottom-0 -left-16 pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-5 relative z-10">
          {/* Baris Identitas Toko & Pintasan Cek Pesanan Kustom */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={LOGO_PATH}
                alt={settings.store_name}
                className="h-11 w-11 rounded-2xl object-cover border border-[#6B9071]/40 shrink-0 shadow-xs"
              />
              <div className="min-w-0">
                <span className="block font-extrabold text-base sm:text-lg tracking-tight text-white truncate">
                  {settings.store_name}
                </span>
                <span className="block text-[11px] text-[#AEC3B0] truncate">
                  Official Digital Store &amp; Custom Studio
                </span>
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onNavigateTab('services')}
              className="px-3.5 py-2 rounded-full bg-[#375534]/85 hover:bg-[#375534] text-[#E3EED4] border border-[#6B9071]/40 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#E3EED4]" />
              <span>Cek Pesanan Kustom</span>
            </motion.button>
          </div>

          {/* Kolom Pencarian Kapsul */}
          <form onSubmit={handleQuickSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-[#AEC3B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Cari e-book, template Excel, slide PPT, atau aset digital..."
              className="w-full pl-11 pr-24 py-3.5 rounded-full bg-[#375534]/55 border border-[#6B9071]/40 text-xs sm:text-sm text-white placeholder:text-[#AEC3B0] focus:outline-none focus:border-[#E3EED4] focus:bg-[#375534]/80 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[#E3EED4] hover:bg-white text-[#0F2A1D] text-xs font-extrabold transition-colors"
            >
              Cari
            </button>
          </form>

          {/* Kartu Hero Utama Melengkung */}
          <div className="rounded-[28px] bg-gradient-to-br from-[#375534] via-[#466943] to-[#6B9071] p-6 sm:p-8 border border-[#AEC3B0]/35 relative overflow-hidden shadow-md">
            <div className="w-44 h-44 rounded-full bg-[#E3EED4]/15 blur-xl absolute -right-10 -bottom-10 pointer-events-none" />

            <div className="max-w-xl space-y-3 relative z-10">
              <span className="inline-block px-3.5 py-1 rounded-full bg-[#0F2A1D]/75 text-[#E3EED4] text-[11px] font-bold tracking-wide">
                ⚡ Pengiriman File Otomatis 24/7 via Email
              </span>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                Solusi Produk Digital Instan &amp; Jasa Kustom
              </h1>

              <p className="text-xs sm:text-sm text-[#E3EED4]/90 leading-relaxed">
                {bannerDescription}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onNavigateTab('shop')}
                  className="pl-5 pr-2 py-2 rounded-full bg-[#0F2A1D] hover:bg-[#163826] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-3 shadow-md transition-all"
                >
                  <span>Jelajahi Katalog</span>
                  <span className="w-8 h-8 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onNavigateTab('services')}
                  className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-[#E3EED4]/30 font-bold text-xs sm:text-sm transition-colors"
                >
                  Layanan Kustom &amp; Garansi
                </motion.button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* 3 GELEMBUNG KEUNGGULAN DENGAN ANIMASI TEKS BERJALAN (MARQUEE) */}
          {/* ================================================================ */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
            {/* Gelembung 1: Akses Instan */}
            <div className="px-2.5 py-2.5 rounded-2xl bg-[#375534]/45 border border-[#6B9071]/35 flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="overflow-hidden whitespace-nowrap">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 8,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[11px] font-extrabold text-white">
                      Akses Instan 24/7 • Pengiriman Otomatis
                    </span>
                    <span className="text-[11px] font-extrabold text-white">
                      Akses Instan 24/7 • Pengiriman Otomatis
                    </span>
                  </motion.div>
                </div>
                <div className="overflow-hidden whitespace-nowrap mt-0.5">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 10,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[10px] text-[#AEC3B0]">
                      File langsung terkirim detik itu juga ke emailmu
                    </span>
                    <span className="text-[10px] text-[#AEC3B0]">
                      File langsung terkirim detik itu juga ke emailmu
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Gelembung 2: QRIS Resmi */}
            <div className="px-2.5 py-2.5 rounded-2xl bg-[#375534]/45 border border-[#6B9071]/35 flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
                <QrCode className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="overflow-hidden whitespace-nowrap">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 8.5,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[11px] font-extrabold text-white">
                      QRIS Resmi • Semua E-Wallet &amp; Bank
                    </span>
                    <span className="text-[11px] font-extrabold text-white">
                      QRIS Resmi • Semua E-Wallet &amp; Bank
                    </span>
                  </motion.div>
                </div>
                <div className="overflow-hidden whitespace-nowrap mt-0.5">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 10.5,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[10px] text-[#AEC3B0]">
                      Belanja praktis tanpa perlu daftar akun atau login
                    </span>
                    <span className="text-[10px] text-[#AEC3B0]">
                      Belanja praktis tanpa perlu daftar akun atau login
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Gelembung 3: Garansi 100% */}
            <div className="px-2.5 py-2.5 rounded-2xl bg-[#375534]/45 border border-[#6B9071]/35 flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="overflow-hidden whitespace-nowrap">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 9,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[11px] font-extrabold text-white">
                      Garansi 100% • Layanan Resmi RizzFlow
                    </span>
                    <span className="text-[11px] font-extrabold text-white">
                      Garansi 100% • Layanan Resmi RizzFlow
                    </span>
                  </motion.div>
                </div>
                <div className="overflow-hidden whitespace-nowrap mt-0.5">
                  <motion.div
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 11,
                      ease: 'linear',
                    }}
                    className="inline-flex items-center gap-6"
                  >
                    <span className="text-[10px] text-[#AEC3B0]">
                      Aman, terpercaya, dan bergaransi bantuan penuh
                    </span>
                    <span className="text-[10px] text-[#AEC3B0]">
                      Aman, terpercaya, dan bergaransi bantuan penuh
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* KONTEN UTAMA BERANDA (LATAR ALABASTER LEMBUT #F6F8F3) */}
      {/* ==================================================================== */}
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        {categories.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                Kategori Pilihan
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('shop')}
                className="text-xs font-bold text-[#375534] hover:text-[#0F2A1D] inline-flex items-center gap-0.5"
              >
                <span>Lihat Semua</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() =>
                    onJumpToShopWithFilter({
                      categoryId: cat.id,
                      filterMode: 'ALL',
                    })
                  }
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/50 text-xs font-bold whitespace-nowrap transition-colors rf-card-shadow"
                >
                  {cat.name}
                </motion.button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                Pilihan Terbaik Untukmu
              </h2>
              <p className="text-xs text-[#6B9071]">
                Ketuk produk untuk detail lengkap, atau tekan (+) untuk memasukkan ke keranjang
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('shop')}
              className="px-3.5 py-1.5 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0]/60 text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Semua ({products.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-[#AEC3B0]/40 text-center">
              <p className="text-sm font-bold text-[#0F2A1D]">
                Katalog produk sedang disiapkan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {featuredProducts.map((product) => {
                const info = getProductCardInfo(product);
                const isAdded = addedProductId === product.id;

                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-[24px] p-2.5 sm:p-3 border border-[#AEC3B0]/35 rf-card-shadow flex flex-col justify-between group"
                  >
                    <div
                      onClick={() => onSelectProduct(product)}
                      className="cursor-pointer"
                    >
                      <div className="relative aspect-[4/3] rounded-[18px] bg-[#E3EED4]/65 overflow-hidden mb-3">
                        <img
                          src={info.coverThumb}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {info.hasDiscount && info.savePercent > 0 ? (
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#375534] text-white shadow-2xs">
                            Hemat {info.savePercent}%
                          </span>
                        ) : product.badge ? (
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E3EED4]/95 text-[#0F2A1D] border border-[#AEC3B0]/60">
                            {product.badge}
                          </span>
                        ) : null}

                        {info.thumbList.length > 1 && (
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F2A1D]/75 text-white inline-flex items-center gap-1">
                            <Images className="w-3 h-3" />
                            <span>{info.thumbList.length}</span>
                          </span>
                        )}
                      </div>

                      <div className="px-1">
                        <h3 className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] line-clamp-2 leading-snug mb-1 group-hover:text-[#375534] transition-colors">
                          {product.title}
                        </h3>
                        <p className="text-[11px] text-[#6B9071] line-clamp-1 mb-2">
                          {product.description}
                        </p>
                      </div>
                    </div>

                    <div className="px-1 pt-1 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {info.hasDiscount && info.origPrice && (
                          <span className="block text-[10px] text-[#6B9071] line-through truncate">
                            {formatRupiah(info.origPrice)}
                          </span>
                        )}
                        <span className="block font-extrabold text-sm sm:text-base text-[#0F2A1D] truncate">
                          {formatRupiah(product.price)}
                        </span>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => onAddToCart(product)}
                        className={
                          isAdded
                            ? 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#375534] text-white flex items-center justify-center shrink-0 shadow-sm'
                            : 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] flex items-center justify-center shrink-0 shadow-sm transition-colors'
                        }
                        title="Tambah ke Keranjang"
                      >
                        {isAdded ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[28px] bg-[#E3EED4] border border-[#AEC3B0] p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#375534] text-[11px] font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Layanan Kustom &amp; Cek Kode Pesanan</span>
            </span>
            <h3 className="text-base sm:text-xl font-extrabold text-[#0F2A1D]">
              {customService.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#375534] leading-relaxed">
              {customService.description}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customService.services.slice(0, 4).map((srv, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-white/80 text-[#0F2A1D] text-[11px] font-bold border border-[#AEC3B0]/60"
                >
                  ✓ {srv}
                </span>
              ))}
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onNavigateTab('services')}
            className="self-start md:self-center pl-5 pr-2.5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-3 shrink-0 transition-colors"
          >
            <span>Pesan / Cek Kode Kustom</span>
            <span className="w-7 h-7 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </span>
          </motion.button>
        </section>
      </div>
    </div>
  );
}