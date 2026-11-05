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
  Info,
} from 'lucide-react';
import { Category, Product } from '@/types';
import {
  CatalogFilterType,
  PRODUCTS_PER_SLIDE,
  VISIBLE_CATEGORY_LIMIT,
  getProductCardInfo,
  formatRupiah,
} from './StorefrontTypes';

interface ShopTabViewProps {
  products: Product[];
  categories: Category[];
  catalogTypeFilter: CatalogFilterType;
  onChangeCatalogType: (type: CatalogFilterType) => void;
  selectedCategoryId: string;
  onChangeCategoryId: (id: string) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  addedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onOpenSubGuide: () => void;
}

export default function ShopTabView({
  products,
  categories,
  catalogTypeFilter,
  onChangeCatalogType,
  selectedCategoryId,
  onChangeCategoryId,
  searchQuery,
  onChangeSearchQuery,
  addedProductId,
  onSelectProduct,
  onAddToCart,
  onOpenSubGuide,
}: ShopTabViewProps) {
  const topCatalogRef = useRef(null as HTMLDivElement | null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Kembali ke slide 1 setiap kali filter berubah
  useEffect(() => {
    setCurrentSlide(1);
  }, [catalogTypeFilter, selectedCategoryId, searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const info = getProductCardInfo(product);
      const pType: CatalogFilterType = info.isSubscription
        ? 'LANGGANAN'
        : 'INSTAN';

      const matchesType =
        catalogTypeFilter === 'ALL' || pType === catalogTypeFilter;
      const matchesCategory =
        selectedCategoryId === 'ALL' ||
        product.category_id === selectedCategoryId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.title.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q);

      return matchesType && matchesCategory && matchesSearch;
    });
  }, [products, catalogTypeFilter, selectedCategoryId, searchQuery]);

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
      {/* Header Halaman Shop (Gaya Gambar 2 Tengah) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2A1D] tracking-tight">
            Katalog Produk
          </h1>
          <p className="text-xs text-[#6B9071]">
            Menampilkan {filteredProducts.length} produk digital &amp; langganan siap pesan
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSubGuide}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0]/60 text-[#0F2A1D] text-xs font-bold transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-[#375534]" />
          <span>Cara Beli Produk Langganan</span>
        </button>
      </div>

      {/* Kolom Pencarian Kapsul */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B9071] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          placeholder="Cari nama produk, e-book, template, atau langganan..."
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

      {/* Filter Tipe Katalog (Semua | File Instan | Langganan) */}
      <div className="grid grid-cols-3 gap-2 bg-[#E3EED4]/65 p-1.5 rounded-full border border-[#AEC3B0]/50">
        <button
          type="button"
          onClick={() => onChangeCatalogType('ALL')}
          className={
            catalogTypeFilter === 'ALL'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#0F2A1D] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          Semua ({products.length})
        </button>
        <button
          type="button"
          onClick={() => onChangeCatalogType('INSTAN')}
          className={
            catalogTypeFilter === 'INSTAN'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          ⚡ File Instan
        </button>
        <button
          type="button"
          onClick={() => onChangeCatalogType('LANGGANAN')}
          className={
            catalogTypeFilter === 'LANGGANAN'
              ? 'py-2 px-3 rounded-full text-xs font-extrabold bg-[#375534] text-white shadow-xs transition-all'
              : 'py-2 px-3 rounded-full text-xs font-bold text-[#375534] hover:text-[#0F2A1D] transition-all'
          }
        >
          👑 Langganan
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
              onChangeCatalogType('ALL');
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
              key={`shop-slide-${currentSlide}-${catalogTypeFilter}-${selectedCategoryId}-${searchQuery}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5"
            >
              {paginatedProducts.map((product) => {
                const info = getProductCardInfo(product);
                const isAdded = addedProductId === product.id;

                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-[24px] p-2.5 sm:p-3.5 border border-[#AEC3B0]/35 rf-card-shadow flex flex-col justify-between group"
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

                        <span
                          className={
                            info.isSubscription
                              ? 'absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0F2A1D] text-[#E3EED4]'
                              : 'absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E3EED4]/95 text-[#0F2A1D] border border-[#AEC3B0]/60'
                          }
                        >
                          {info.isSubscription
                            ? '👑 Langganan'
                            : product.badge || '⚡ Instan'}
                        </span>

                        {info.hasDiscount && info.savePercent > 0 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#375534] text-white">
                            -{info.savePercent}%
                          </span>
                        )}

                        {info.thumbList.length > 1 && (
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F2A1D]/75 text-white inline-flex items-center gap-1">
                            <Images className="w-3 h-3" />
                            <span>{info.thumbList.length}</span>
                          </span>
                        )}
                      </div>

                      <div className="px-1">
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
                        title={
                          info.isSubscription
                            ? 'Pilih Opsi Beli Langganan'
                            : 'Tambah ke Keranjang'
                        }
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