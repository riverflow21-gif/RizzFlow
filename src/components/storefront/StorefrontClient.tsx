'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  Sparkles,
  Check,
  ArrowRight,
  FileText,
  ChevronLeft,
  ChevronRight,
  Images,
} from 'lucide-react';
import { supabase, parseThumbnails } from '@/lib/supabase';
import { Category, Product, CartItem, StoreSettings } from '@/types';

interface StorefrontClientProps {
  initialProducts: Product[];
  categories: Category[];
  settings: StoreSettings;
}

const CART_STORAGE_KEY = 'rizzflow_cart_v1';

const OLD_DEFAULT_DESC =
  'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.';
const NEW_GENERAL_DESC =
  'Solusi Produk Digital Instan, Praktis, dan Berkualitas. Dapatkan berbagai koleksi e-book, dokumen, template, hingga karya digital pilihan dengan pengiriman otomatis detik itu juga.';

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();

  // State data produk & kategori yang selalu disegarkan otomatis saat halaman dibuka di HP/Laptop
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);

  // State pencarian, kategori aktif, modal detail produk, galeri foto, dan keranjang
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const bannerDescription =
    !settings.banner_description || settings.banner_description === OLD_DEFAULT_DESC
      ? NEW_GENERAL_DESC
      : settings.banner_description;

  // Segarkan data katalog langsung dari Supabase setiap kali halaman toko dibuka
  useEffect(() => {
    const refreshStorefrontData = async () => {
      const [prodRes, catRes, setRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(*)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name', { ascending: true }),
        supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (setRes.data) setSettings(setRes.data as StoreSettings);
    };

    refreshStorefrontData();
  }, []);

  // Muat isi keranjang dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.error('Gagal memuat keranjang dari localStorage:', e);
    }
  }, []);

  const updateCartStorage = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
    } catch (e) {
      console.error('Gagal menyimpan keranjang ke localStorage:', e);
    }
  };

  // Fungsi menambahkan produk ke keranjang (menyimpan gambar sampul pertama agar tampil rapi di Checkout)
  const handleAddToCart = (product: Product) => {
    const primaryThumb = parseThumbnails(product.thumbnail_url)[0] || product.thumbnail_url;
    const normalizedProduct: Product = {
      ...product,
      thumbnail_url: primaryThumb,
    };

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    let updated: CartItem[];

    if (existingIndex > -1) {
      updated = cart.map((item, idx) =>
        idx === existingIndex
          ? { product: normalizedProduct, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updated = [...cart, { product: normalizedProduct, quantity: 1 }];
    }

    updateCartStorage(updated);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1200);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    updateCartStorage(updated);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === 'ALL' || product.category_id === selectedCategoryId;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.title.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const activeProductImages = useMemo(
    () => (activeProduct ? parseThumbnails(activeProduct.thumbnail_url) : []),
    [activeProduct]
  );

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] flex flex-col overflow-x-hidden">
      {/* Bilah Navigasi Atas */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.jpg"
              alt={settings.store_name}
              className="h-10 w-auto rounded-lg object-contain shadow-xs shrink-0"
            />
            <span className="font-bold text-lg tracking-tight text-[#0F172A] truncate">
              {settings.store_name}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200/80 transition-colors shrink-0"
            aria-label="Buka Keranjang Belanja"
          >
            <ShoppingBag className="w-5 h-5 text-[#10B981]" />
            <span className="text-sm font-semibold hidden sm:inline">Keranjang</span>
            {totalCartItems > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#10B981] text-white">
                {totalCartItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Konten Utama Katalog Toko */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10">
        {/* Banner Sambutan */}
        <section className="mb-8 bg-gradient-to-br from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-100 rounded-2xl p-6 sm:p-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#059669] text-xs font-semibold border border-emerald-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Akses Instan • Transaksi Aman • Pengiriman Otomatis 24/7</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mb-2">
            Semua Kebutuhan Produk Digitalmu di Satu Tempat
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-2xl leading-relaxed break-words">
            {bannerDescription}
          </p>
        </section>

        {/* Kolom Pencarian & Filter Kategori */}
        <section className="mb-6 space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari e-book, template, atau produk digital lainnya..."
              className="w-full pl-11 pr-10 py-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategoryId === 'ALL'
                  ? 'bg-[#10B981] text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-slate-200/80'
              }`}
            >
              Semua Produk
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#10B981] text-white shadow-sm shadow-emerald-500/20'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-slate-200/80'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Grid Katalog Produk */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 px-4">
            <FileText className="w-10 h-10 text-[#64748B] mx-auto mb-3 stroke-[1.5]" />
            <p className="font-semibold text-[#0F172A] mb-1">Produk tidak ditemukan</p>
            <p className="text-sm text-[#64748B]">
              Coba gunakan kata kunci pencarian lain atau pilih kategori Semua Produk.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {filteredProducts.map((product) => {
              const isAdded = addedProductId === product.id;
              const thumbList = parseThumbnails(product.thumbnail_url);
              const coverThumb = thumbList[0] || '';

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.99 }}
                  className="group bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col min-w-0"
                >
                  <div
                    onClick={() => {
                      setActiveProduct(product);
                      setActiveImageIndex(0);
                    }}
                    className="cursor-pointer flex-1 flex flex-col min-w-0"
                  >
                    <div className="relative aspect-[4/3] bg-[#F8FAFC] overflow-hidden border-b border-slate-100">
                      <img
                        src={coverThumb}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {product.badge && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-emerald-200 shadow-sm">
                          {product.badge}
                        </span>
                      )}
                      {thumbList.length > 1 && (
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/70 text-white inline-flex items-center gap-1">
                          <Images className="w-3 h-3" />
                          <span>{thumbList.length} Foto</span>
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col min-w-0">
                      <h2 className="font-bold text-sm sm:text-base text-[#0F172A] line-clamp-2 break-words mb-1 group-hover:text-[#059669] transition-colors">
                        {product.title}
                      </h2>
                      <p className="text-xs text-[#64748B] line-clamp-2 break-words mb-3 flex-1">
                        {product.description}
                      </p>
                      <div className="font-extrabold text-sm sm:text-base text-[#0F172A]">
                        Rp{product.price.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className={`w-full py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
                        isAdded
                          ? 'bg-[#059669] text-white'
                          : 'bg-[#10B981] hover:bg-[#059669] text-white shadow-sm shadow-emerald-500/15'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Ditambahkan</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Keranjang</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Tombol Keranjang Melayang di HP */}
      <AnimatePresence>
        {totalCartItems > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 inset-x-4 z-20 sm:hidden"
          >
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#10B981] text-white shadow-lg shadow-emerald-600/30 flex items-center justify-between font-semibold text-sm"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>{totalCartItems} Produk di Keranjang</span>
              </div>
              <div className="flex items-center gap-1 font-bold">
                <span>Rp{totalCartPrice.toLocaleString('id-ID')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detail Produk dengan Galeri Banyak Thumbnail */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveProduct(null)}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col"
            >
              <div className="relative aspect-[16/10] bg-[#F8FAFC] border-b border-slate-100">
                <img
                  src={activeProductImages[activeImageIndex] || ''}
                  alt={activeProduct.title}
                  className="w-full h-full object-cover"
                />

                {/* Navigasi Geser Gambar Jika Thumbnail Lebih dari 1 */}
                {activeProductImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev === 0 ? activeProductImages.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md hover:bg-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev === activeProductImages.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-14 top-3 px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-xs font-bold"
                    >
                      {activeImageIndex + 1} / {activeProductImages.length}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev === activeProductImages.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md hover:bg-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md hover:bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Deretan Thumbnail Kecil Jika Gambar Lebih dari 1 */}
              {activeProductImages.length > 1 && (
                <div className="flex gap-2 px-5 pt-3 overflow-x-auto no-scrollbar">
                  {activeProductImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        activeImageIndex === idx
                          ? 'border-[#10B981] scale-105'
                          : 'border-slate-200 opacity-70'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {activeProduct.badge && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669]">
                    {activeProduct.badge}
                  </span>
                )}
                <h3 className="text-xl font-extrabold text-[#0F172A] break-words">
                  {activeProduct.title}
                </h3>
                <div className="text-2xl font-extrabold text-[#10B981]">
                  Rp{activeProduct.price.toLocaleString('id-ID')}
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                    Deskripsi Produk Digital
                  </h4>
                  <p className="text-sm text-[#0F172A] whitespace-pre-line leading-relaxed break-words">
                    {activeProduct.description}
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-[#F8FAFC] flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(activeProduct);
                    setActiveProduct(null);
                    setIsCartOpen(true);
                  }}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm transition-colors shadow-sm"
                >
                  Tambah ke Keranjang & Lihat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-Over Keranjang Belanja */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#10B981]" />
                  <h3 className="font-bold text-lg text-[#0F172A]">Keranjang Belanja</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                    <p className="font-semibold text-[#0F172A] mb-1">
                      Keranjang masih kosong
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Silakan pilih produk digital yang kamu butuhkan dari katalog.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const thumbUrl =
                      parseThumbnails(item.product.thumbnail_url)[0] ||
                      item.product.thumbnail_url;
                    return (
                      <div
                        key={item.product.id}
                        className="flex gap-3.5 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/70"
                      >
                        <img
                          src={thumbUrl}
                          alt={item.product.title}
                          className="w-16 h-16 rounded-lg object-cover bg-white border border-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-[#0F172A] truncate">
                            {item.product.title}
                          </h4>
                          <p className="text-xs font-semibold text-[#10B981] mt-0.5">
                            Rp{item.product.price.toLocaleString('id-ID')}
                          </p>

                          <div className="flex items-center justify-between mt-3">
                            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, -1)}
                                className="text-[#64748B] hover:text-[#0F172A]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-bold w-5 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, 1)}
                                className="text-[#64748B] hover:text-[#0F172A]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(item.product.id, -item.quantity)
                              }
                              className="text-[#64748B] hover:text-[#EF4444] p-1"
                              title="Hapus produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-100 bg-[#F8FAFC] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">Subtotal Pesanan</span>
                    <span className="text-lg font-extrabold text-[#0F172A]">
                      Rp{totalCartPrice.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      router.push('/checkout');
                    }}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-colors"
                  >
                    <span>Lanjut ke Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer dengan Link "laporkan" */}
      <footer className="border-t border-slate-100 py-6 text-xs text-[#64748B] bg-[#F8FAFC] mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {settings.store_name}. Seluruh hak cipta dilindungi.
          </span>
          <a
            href="mailto:rizzflow10@gmail.com?subject=Laporan%20Website%20RizzFlow"
            className="font-semibold text-[#059669] hover:text-[#10B981] hover:underline transition-colors"
          >
            laporkan
          </a>
        </div>
      </footer>
    </div>
  );
}