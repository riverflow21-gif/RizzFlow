'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
  X,
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
  onChangeCategoryId: (catId: string) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  addedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
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
  addedProductId,
  onSelectProduct,
  onAddToCart,
}: ShopTabViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Reset ke halaman 1 setiap kali filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, selectedCategoryId, searchQuery]);

  const filteredProducts = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    let list = products.filter((product) => {
      if (
        selectedCategoryId !== 'ALL' &&
        product.category_id !== selectedCategoryId
      ) {
        return false;
      }

      if (cleanQuery) {
        const matchTitle = product.title.toLowerCase().includes(cleanQuery);
        const matchDesc = (product.description || '')
          .toLowerCase()
          .includes(cleanQuery);
        if (!matchTitle && !matchDesc) return false;
      }

      if (filterMode === 'DISCOUNT') {
        return getProductCardInfo(product).hasDiscount;
      }

      return true;
    });

    if (filterMode === 'CHEAPEST') {
      list = [...list].sort((a, b) => a.price - b.price);
    }

    return list;
  }, [products, selectedCategoryId, searchQuery, filterMode]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_SLIDE)
  );
  const safePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const startIdx = (safePage - 1) * PRODUCTS_PER_SLIDE;
    return filteredProducts.slice(startIdx, startIdx + PRODUCTS_PER_SLIDE);
  }, [filteredProducts, safePage]);

  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, VISIBLE_CATEGORY_LIMIT);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-5 pb-12 space-y-6">
      {/* Header & Pencarian Katalog */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D]">
              Katalog Produk Digital
            </h1>
            <p className="text-xs text-[#6B9071] mt-0.5">
              Pilih produk siap pakai, bayar QRIS, dan terima file otomatis via email
            </p>
          </div>
          <span className="text-xs font-extrabold text-[#375534]">
            {filteredProducts.length} Produk Tersedia
          </span>
        </div>

        {/* Kolom Pencarian */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B9071] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Cari produk di katalog..."
            className="w-full pl-11 pr-10 py-3.5 rounded-full bg-white border border-[#AEC3B0]/70 text-xs sm:text-sm text-[#0F2A1D] placeholder:text-[#6B9071] focus:outline-none focus:border-[#0F2A1D] rf-card-shadow"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onChangeSearchQuery('')}
              className="w-7 h-7 rounded-full bg-[#F6F8F3] hover:bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Urutan (Bersih Tanpa Emote) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeFilterMode('ALL')}
            className={
              filterMode === 'ALL'
                ? 'px-4 py-2 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold shadow-2xs'
                : 'px-4 py-2 rounded-full bg-white hover:bg-[#E3EED4] text-[#375534] border border-[#AEC3B0]/60 text-xs font-bold'
            }
          >
            Terbaru
          </button>

          <button
            type="button"
            onClick={() => onChangeFilterMode('DISCOUNT')}
            className={
              filterMode === 'DISCOUNT'
                ? 'px-4 py-2 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold shadow-2xs'
                : 'px-4 py-2 rounded-full bg-white hover:bg-[#E3EED4] text-[#375534] border border-[#AEC3B0]/60 text-xs font-bold'
            }
          >
            Sedang Diskon
          </button>

          <button
            type="button"
            onClick={() => onChangeFilterMode('CHEAPEST')}
            className={
              filterMode === 'CHEAPEST'
                ? 'px-4 py-2 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold shadow-2xs'
                : 'px-4 py-2 rounded-full bg-white hover:bg-[#E3EED4] text-[#375534] border border-[#AEC3B0]/60 text-xs font-bold'
            }
          >
            Termurah
          </button>
        </div>

        {/* Filter Kategori */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeCategoryId('ALL')}
              className={
                selectedCategoryId === 'ALL'
                  ? 'px-3.5 py-1.5 rounded-xl bg-[#375534] text-white text-xs font-extrabold'
                  : 'px-3.5 py-1.5 rounded-xl bg-[#E3EED4]/65 hover:bg-[#E3EED4] text-[#0F2A1D] text-xs font-bold'
              }
            >
              Semua Kategori
            </button>

            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onChangeCategoryId(cat.id)}
                className={
                  selectedCategoryId === cat.id
                    ? 'px-3.5 py-1.5 rounded-xl bg-[#375534] text-white text-xs font-extrabold'
                    : 'px-3.5 py-1.5 rounded-xl bg-[#E3EED4]/65 hover:bg-[#E3EED4] text-[#0F2A1D] text-xs font-bold'
                }
              >
                {cat.name}
              </button>
            ))}

            {categories.length > VISIBLE_CATEGORY_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllCategories((v) => !v)}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#AEC3B0] text-[#375534] text-xs font-extrabold"
              >
                {showAllCategories
                  ? 'Ringkas'
                  : `Lainnya (+${categories.length - VISIBLE_CATEGORY_LIMIT})`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Grid Produk */}
      {paginatedProducts.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-[#AEC3B0]/50 text-center space-y-3 rf-card-shadow">
          <p className="text-sm font-extrabold text-[#0F2A1D]">
            Produk tidak ditemukan
          </p>
          <p className="text-xs text-[#6B9071]">
            Coba ubah kata kunci pencarian atau pilih kategori lainnya.
          </p>
          <button
            type="button"
            onClick={() => {
              onChangeSearchQuery('');
              onChangeCategoryId('ALL');
              onChangeFilterMode('ALL');
            }}
            className="px-5 py-2.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold"
          >
            Tampilkan Semua Produk
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5">
          {paginatedProducts.map((product) => {
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

      {/* Navigasi Halaman (Pagination) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-full bg-white border border-[#AEC3B0] text-xs font-extrabold text-[#0F2A1D] inline-flex items-center gap-1 disabled:opacity-45"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <span className="text-xs font-extrabold text-[#375534]">
            Halaman {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1 disabled:opacity-45"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}