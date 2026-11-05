'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Images,
  FileText,
  Heart,
} from 'lucide-react';
import { Category, Product } from '@/types';
import {
  ShopFilterMode,
  PRODUCTS_PER_SLIDE,
  VISIBLE_CATEGORY_LIMIT,
  getProductCardInfo,
  formatRupiah,
} from './StorefrontTypes';

interface ShopTabViewProps {
  products: Product[];
  categories: Category[];
  filterMode: ShopFilterMode;
  onChangeFilterMode: (mode: ShopFilterMode) => void;
  selectedCategoryId: string;
  onChangeCategoryId: (id: string) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  favoriteIds: string[];
  addedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
}

export default function ShopTabView({
  products,
  categories,
  filterMode,
  onChangeFilterMode,
  selectedCategoryId,
  onChangeCategoryId,
  searchQuery,
  onChangeSearchQuery,
  favoriteIds,
  addedProductId,
  onSelectProduct,
  onAddToCart,
  onToggleFavorite,
}: ShopTabViewProps) {
  const topCatalogRef = useRef(null as HTMLDivElement | null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Kembali ke halaman 1 setiap kali filter atau pencarian berubah
  useEffect(() => {
    setCurrentSlide(1);
  }, [filterMode, selectedCategoryId, searchQuery]);

  const filteredProducts = useMemo(() => {
    const matching = products.filter((product) => {
      const info = getProductCardInfo(product);

      const matchesMode =
        filterMode !== 'DISCOUNT' || (info.hasDiscount && info.savePercent > 0);
      const matchesCategory =
        selectedCategoryId === 'ALL' ||
        product.category_id === selectedCategoryId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.title.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q);

      return matchesMode && matchesCategory && matchesSearch;
    });

    if (filterMode === 'CHEAPEST') {
      return [...matching].sort((a, b) => a.price - b.price);
    }

    return matching;
  }, [products, filterMode, selectedCategoryId, searchQuery]);

  const totalSlides = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_SLIDE)
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentSlide - 1) * PRODUCTS_PER_SLIDE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_SLIDE);
  }, [filteredProducts, currentSlide]);

  const displayedCategories = showAllCategories
    ? categories
    : categories.slice(0, VISIBLE_CATEGORY_LIMIT);

  const hiddenCategoryCount = Math.max(
    0,
    categories.length - VISIBLE_CATEGORY_LIMIT
  );

  return (
    <div
      ref={topCatalogRef}
      className="max-w-5xl mx-auto px-4 pt-5 pb-10 space-y-5"
    >
      {/* Header Halaman Shop (Bersih & Estetik — Gaya Gambar 2 Tengah) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2A1D] tracking-tight">
            Katalog Produk Digital
          </h1>
          <p className="text-xs text-[#6B9071]">
            Menampilkan {filteredProducts.length} produk siap unduh dengan pengiriman instan
          </p>
        </div>
      </div>

      {/* Kolom Pencarian Kapsul */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B9071] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          placeholder="Cari e-book, template Excel, slide PPT, atau produk lainnya..."
          className="w-full pl-11 pr-10 py-3.5 rounded-full bg-white border border-[#AEC3B0]/60 text-xs sm:text-sm text-[#0F2A1D] placeholder:text-[#6B9071] focus:outline-none focus:border-[#375534] rf-card-shadow transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onChangeSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B9071] hover:text-[#0F2A1D]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Cepat (Semua Produk | Sedang Diskon | Harga Termurah) */}
      <div className="grid grid-cols-3 gap-2 bg-[#E3EED4]/65 p-1.5 rounded-full border border-[#AEC3B0]/50">
        <button
          type="button"
          onClick={() => onChangeFilterMode('ALL')}
          className={
            filterMode === 'ALL'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#0F2A1D] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          Semua ({products.length})
        </button>
        <button
          type="button"
          onClick={() => onChangeFilterMode('DISCOUNT')}
          className={
            filterMode === 'DISCOUNT'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          🔥 Sedang Promo
        </button>
        <button
          type="button"
          onClick={() => onChangeFilterMode('CHEAPEST')}
          className={
            filterMode === 'CHEAPEST'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          💰 Termurah
        </button>
      </div>

      {/* Pil Kategori Kapsul (Persis Pil "All | Cleanser | Serum" di Gambar 2 Tengah) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeCategoryId('ALL')}
          className={
            selectedCategoryId === 'ALL'
              ? 'px-4 py-2 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
              : 'px-4 py-2 rounded-full text-xs font-bold bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/50 transition-all'
          }
        >
          Semua Kategori
        </button>

        {displayedCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChangeCategoryId(cat.id)}
            className={
              selectedCategoryId === cat.id
                ? 'px-4 py-2 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
                : 'px-4 py-2 rounded-full text-xs font-bold bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/50 transition-all'
            }
          >
            {cat.name}
          </button>
        ))}

        {hiddenCategoryCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllCategories((prev) => !prev)}
            className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#E3EED4] hover:bg-[#AEC3B0]/50 text-[#0F2A1D] border border-[#AEC3B0] transition-colors"
          >
            {showAllCategories
              ? 'Sembunyikan'
              : `Lainnya... (+${hiddenCategoryCount})`}
          </button>
        )}
      </div>

      {/* Grid Produk (Maksimal 6 Produk per Slide — Gaya Kartu Gambar 2 Tengah) */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-[28px] border border-[#AEC3B0]/40 px-4 rf-card-shadow">
          <FileText className="w-10 h-10 text-[#6B9071] mx-auto mb-2.5 stroke-[1.5]" />
          <p className="font-extrabold text-sm text-[#0F2A1D] mb-1">
            Produk yang kamu cari belum ditemukan
          </p>
          <p className="text-xs text-[#6B9071] mb-4">
            Coba gunakan kata kunci lain atau tampilkan semua kategori.
          </p>
          <button
            type="button"
            onClick={() => {
              onChangeFilterMode('ALL');
              onChangeCategoryId('ALL');
              onChangeSearchQuery('');
            }}
            className="px-5 py-2.5 rounded-full bg-[#0F2A1D] text-white text-xs font-bold"
          >
            Reset Filter Pencarian
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`shop-slide-${currentSlide}-${filterMode}-${selectedCategoryId}-${searchQuery}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5"
            >
              {paginatedProducts.map((product) => {
                const info = getProductCardInfo(product);
                const isAdded = addedProductId === product.id;
                const isFav = favoriteIds.includes(product.id);

                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-[24px] p-2.5 sm:p-3.5 border border-[#AEC3B0]/35 rf-card-shadow flex flex-col justify-between group"
                  >
                    <div>
                      <div
                        onClick={() => onSelectProduct(product)}
                        className="relative aspect-[4/3] rounded-[18px] bg-[#E3EED4]/65 overflow-hidden mb-3 cursor-pointer"
                      >
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

                        {/* Tombol Hati Favorit di Kanan Atas */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(product.id);
                          }}
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#0F2A1D] flex items-center justify-center shadow-xs transition-transform active:scale-90"
                          aria-label="Simpan ke Favorit"
                        >
                          <Heart
                            className={
                              isFav
                                ? 'w-4 h-4 fill-[#375534] text-[#375534]'
                                : 'w-4 h-4 text-[#0F2A1D]'
                            }
                          />
                        </button>

                        {info.thumbList.length > 1 && (
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F2A1D]/75 text-white inline-flex items-center gap-1">
                            <Images className="w-3 h-3" />
                            <span>{info.thumbList.length}</span>
                          </span>
                        )}
                      </div>

                      <div
                        onClick={() => onSelectProduct(product)}
                        className="px-1 cursor-pointer"
                      >
                        <h2 className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] line-clamp-2 leading-snug mb-1 group-hover:text-[#375534] transition-colors">
                          {product.title}
                        </h2>
                        <p className="text-[11px] text-[#6B9071] line-clamp-1 mb-2.5">
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
            </motion.div>
          </AnimatePresence>

          {/* Navigasi Slide Kapsul (Muncul Jika Produk Lebih dari 6) */}
          {totalSlides > 1 && (
            <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 rounded-full border border-[#AEC3B0]/50 rf-card-shadow">
              <button
                type="button"
                disabled={currentSlide === 1}
                onClick={() => {
                  setCurrentSlide((p) => Math.max(1, p - 1));
                  topCatalogRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white text-xs font-extrabold disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs font-extrabold text-[#0F2A1D]">
                Halaman {currentSlide} dari {totalSlides}
              </span>

              <button
                type="button"
                disabled={currentSlide === totalSlides}
                onClick={() => {
                  setCurrentSlide((p) => Math.min(totalSlides, p + 1));
                  topCatalogRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white text-xs font-extrabold disabled:opacity-40 transition-colors"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}