'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ShoppingBag,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  Store,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Category, Product, CartItem, StoreSettings } from '@/types';
import {
  StorefrontTab,
  ShopFilterMode,
  CustomServiceConfig,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
  CART_STORAGE_KEY,
  LOGO_PATH,
  parseThumbnails,
  formatRupiah,
} from './StorefrontTypes';
import HomeTabView from './HomeTabView';
import ShopTabView from './ShopTabView';
import ServicesTabView from './ServicesTabView';
import ProductDetailSheet from './ProductDetailSheet';

interface StorefrontClientProps {
  initialProducts: Product[];
  categories: Category[];
  settings: StoreSettings;
}

type NullableProduct = Product | null;
type NullableString = string | null;

interface NavBarItem {
  id: StorefrontTab;
  label: string;
}

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();

  const [products, setProducts] = useState(initialProducts as Product[]);
  const [categories, setCategories] = useState(
    initialCategories as Category[]
  );
  const [settings, setSettings] = useState(initialSettings as StoreSettings);
  const [customService, setCustomService] = useState(
    DEFAULT_CUSTOM_SERVICE_CONFIG as CustomServiceConfig
  );

  // Navigasi 3 Halaman Bersih: Home | Katalog | Layanan
  const [activeTab, setActiveTab] = useState('home' as StorefrontTab);

  // Filter Katalog
  const [shopFilterMode, setShopFilterMode] = useState(
    'ALL' as ShopFilterMode
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Produk & Keranjang Belanja
  const [activeProduct, setActiveProduct] = useState(
    null as NullableProduct
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState([] as CartItem[]);
  const [addedProductId, setAddedProductId] = useState(
    null as NullableString
  );

  useEffect(() => {
    const refreshData = async () => {
      const [prodRes, catRes, setRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(*)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true }),
        supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (setRes.data) setSettings(setRes.data as StoreSettings);

      try {
        const cfgRes = await fetch('/api/messages?config=1');
        if (cfgRes.ok) {
          const cfgData = (await cfgRes.json()) as {
            customServiceConfig?: CustomServiceConfig;
          };
          if (cfgData.customServiceConfig) {
            setCustomService(cfgData.customServiceConfig);
          }
        }
      } catch {
        // Gunakan konfigurasi default
      }
    };

    refreshData();
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart) as CartItem[];
        if (Array.isArray(parsedCart)) setCart(parsedCart);
      }
    } catch (e) {
      console.error('Gagal memuat keranjang:', e);
    }
  }, []);

  const updateCartStorage = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
    } catch (e) {
      console.error('Gagal menyimpan keranjang:', e);
    }
  };

  const isAnyOverlayOpen = Boolean(activeProduct || isCartOpen);

  useEffect(() => {
    if (isAnyOverlayOpen) {
      document.body.style.overflow = 'hidden';
      if (!window.history.state?.rizzflowOverlay) {
        window.history.pushState({ rizzflowOverlay: true }, '');
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyOverlayOpen]);

  useEffect(() => {
    const handleHardwareBack = () => {
      if (activeProduct || isCartOpen) {
        setActiveProduct(null);
        setIsCartOpen(false);
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handleHardwareBack);
    return () => window.removeEventListener('popstate', handleHardwareBack);
  }, [activeProduct, isCartOpen, activeTab]);

  const closeOverlayCleanly = () => {
    setActiveProduct(null);
    setIsCartOpen(false);
    if (window.history.state?.rizzflowOverlay) {
      window.history.back();
    }
  };

  const handleNavigateTab = (tab: StorefrontTab) => {
    if (tab !== 'home' && activeTab === 'home') {
      window.history.pushState({ rizzflowTab: tab }, '');
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToShopWithFilter = (params: {
    filterMode?: ShopFilterMode;
    categoryId?: string;
    search?: string;
  }) => {
    if (params.filterMode !== undefined) setShopFilterMode(params.filterMode);
    if (params.categoryId !== undefined)
      setSelectedCategoryId(params.categoryId);
    if (params.search !== undefined) setSearchQuery(params.search);
    handleNavigateTab('shop');
  };

  const handleAddProductWithQuantity = (product: Product, qty: number) => {
    const primaryThumb =
      parseThumbnails(product.thumbnail_url)[0] || product.thumbnail_url;
    const normalizedProduct: Product = {
      ...product,
      thumbnail_url: primaryThumb,
    };

    const existingIdx = cart.findIndex(
      (item) => item.product.id === product.id
    );
    let updated: CartItem[];

    if (existingIdx > -1) {
      updated = cart.map((item, idx) =>
        idx === existingIdx
          ? { product: normalizedProduct, quantity: item.quantity + qty }
          : item
      );
    } else {
      updated = [...cart, { product: normalizedProduct, quantity: qty }];
    }

    updateCartStorage(updated);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1200);
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
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

  const getWhatsAppUrl = (customText: string): NullableString => {
    const rawWa = customService.admin_whatsapp || settings.support_contact || '';
    const digits = rawWa.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const formatted = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(customText)}`;
  };

  const getTelegramUrl = (): NullableString => {
    const rawTg = (customService.admin_telegram || '').trim().replace(/^@/, '');
    if (!rawTg) return null;
    return rawTg.startsWith('http') ? rawTg : `https://t.me/${rawTg}`;
  };

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const navItems: NavBarItem[] = [
    { id: 'home', label: 'Home' },
    { id: 'shop', label: 'Katalog' },
    { id: 'services', label: 'Layanan' },
  ];

  const renderNavIcon = (id: StorefrontTab, isActive: boolean) => {
    const cls = isActive
      ? 'w-4 h-4 stroke-[2.4] text-[#0F2A1D] shrink-0'
      : 'w-4 h-4 stroke-[2] shrink-0';
    if (id === 'home') return <Home className={cls} />;
    if (id === 'shop') return <Store className={cls} />;
    return <Sparkles className={cls} />;
  };

  return (
    <div
      className={
        totalCartItems > 0
          ? 'min-h-screen bg-[#F6F8F3] text-[#0F2A1D] flex flex-col pb-40 md:pb-24'
          : 'min-h-screen bg-[#F6F8F3] text-[#0F2A1D] flex flex-col pb-24 md:pb-8'
      }
    >
      {/* ==================================================================== */}
      {/* TOP BAR STICKY (Tanpa Tombol Keranjang di Pojok Atas) */}
      {/* ==================================================================== */}
      <header
        className={
          activeTab === 'home'
            ? 'hidden md:block sticky top-0 z-30 backdrop-blur-md bg-[#F6F8F3]/90 border-b border-[#AEC3B0]/40'
            : 'sticky top-0 z-30 backdrop-blur-md bg-[#F6F8F3]/90 border-b border-[#AEC3B0]/40'
        }
      >
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigateTab('home')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <img
              src={LOGO_PATH}
              alt={settings.store_name}
              className="h-9 w-9 rounded-xl object-contain bg-white p-0.5 border border-[#AEC3B0]/60 shrink-0"
            />
            <span className="font-extrabold text-base sm:text-lg text-[#0F2A1D] truncate">
              {settings.store_name}
            </span>
          </button>

          {/* Menu Kapsul Tengah Khusus Layar Desktop/Laptop */}
          <nav className="hidden md:flex items-center gap-1.5 bg-white p-1.5 rounded-full border border-[#AEC3B0]/50 rf-card-shadow">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigateTab(item.id)}
                  className={
                    isActive
                      ? 'px-5 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs inline-flex items-center gap-1.5 transition-all'
                      : 'px-5 py-1.5 rounded-full text-[#6B9071] hover:text-[#0F2A1D] font-bold text-xs inline-flex items-center gap-1.5 transition-all'
                  }
                >
                  {renderNavIcon(item.id, isActive)}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="text-[11px] font-bold text-[#6B9071] hidden sm:block">
            Official Store
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* AREA KONTEN 3 HALAMAN (HOME | KATALOG | LAYANAN) */}
      {/* ==================================================================== */}
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="tab-home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <HomeTabView
                products={products}
                categories={categories}
                settings={settings}
                customService={customService}
                addedProductId={addedProductId}
                onSelectProduct={(p) => setActiveProduct(p)}
                onAddToCart={(p) => handleAddProductWithQuantity(p, 1)}
                onNavigateTab={handleNavigateTab}
                onJumpToShopWithFilter={handleJumpToShopWithFilter}
              />
            </motion.div>
          )}

          {activeTab === 'shop' && (
            <motion.div
              key="tab-shop"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ShopTabView
                products={products}
                categories={categories}
                filterMode={shopFilterMode}
                onChangeFilterMode={setShopFilterMode}
                selectedCategoryId={selectedCategoryId}
                onChangeCategoryId={setSelectedCategoryId}
                searchQuery={searchQuery}
                onChangeSearchQuery={setSearchQuery}
                addedProductId={addedProductId}
                onSelectProduct={(p) => setActiveProduct(p)}
                onAddToCart={(p) => handleAddProductWithQuantity(p, 1)}
              />
            </motion.div>
          )}

          {activeTab === 'services' && (
            <motion.div
              key="tab-services"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ServicesTabView
                customService={customService}
                storeName={settings.store_name}
                whatsappUrl={getWhatsAppUrl(
                  `Halo Admin ${settings.store_name}, saya ingin berkonsultasi mengenai Layanan Kustom.`
                )}
                telegramUrl={getTelegramUrl()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Ringkas */}
      <footer className="border-t border-[#AEC3B0]/40 py-5 text-xs text-[#6B9071] bg-[#E3EED4]/35">
        <div className="max-w-5xl mx-auto px-4 flex flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {settings.store_name}. Seluruh hak cipta dilindungi.
          </span>
          <a
            href="mailto:rizzflow10@gmail.com?subject=Laporan%20Website%20RizzFlow"
            className="font-extrabold text-[#375534] hover:text-[#0F2A1D] hover:underline transition-colors"
          >
            laporkan
          </a>
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* KERANJANG MENGAPUNG DI BAWAH LAYAR (Hanya Muncul Saat Ada Produk) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {totalCartItems > 0 && (
          <motion.div
            initial={{ y: 70, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 70, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed bottom-[76px] md:bottom-6 inset-x-4 z-30 flex justify-center pointer-events-none"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsCartOpen(true)}
              className="w-full max-w-md py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] border-2 border-[#6B9071] rf-bottom-bar-shadow flex items-center justify-between gap-3 pointer-events-auto transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs flex items-center justify-center shrink-0">
                  {totalCartItems}
                </span>
                <div className="text-left min-w-0">
                  <span className="block text-xs font-extrabold text-white truncate">
                    Keranjang Belanja
                  </span>
                  <span className="block text-[10px] text-[#AEC3B0] truncate">
                    Ketuk untuk periksa &amp; lanjut bayar
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-extrabold text-sm text-[#E3EED4]">
                  {formatRupiah(totalCartPrice)}
                </span>
                <span className="w-7 h-7 rounded-full bg-[#375534] text-white flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* FLOATING BOTTOM NAVIGATION BAR (HOME | KATALOG | LAYANAN) */}
      {/* ==================================================================== */}
      <div className="fixed bottom-4 inset-x-4 z-30 md:hidden flex justify-center pointer-events-none">
        <nav className="bg-white/95 backdrop-blur-md border border-[#AEC3B0]/60 rounded-full p-1.5 rf-bottom-bar-shadow flex items-center justify-between gap-1.5 w-full max-w-sm pointer-events-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => handleNavigateTab(item.id)}
                className={
                  isActive
                    ? 'flex-1 py-2.5 px-3 rounded-full bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all'
                    : 'flex-1 py-2.5 px-3 rounded-full text-[#6B9071] hover:text-[#0F2A1D] font-bold text-xs flex items-center justify-center gap-1.5 transition-all'
                }
              >
                {renderNavIcon(item.id, isActive)}
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* ==================================================================== */}
      {/* LEMBARAN DETAIL PRODUK 2/3 LAYAR */}
      {/* ==================================================================== */}
      <ProductDetailSheet
        product={activeProduct}
        storeName={settings.store_name}
        onClose={closeOverlayCleanly}
        onAddWithQuantity={(prod, qty) => {
          handleAddProductWithQuantity(prod, qty);
          setActiveProduct(null);
        }}
      />

      {/* ==================================================================== */}
      {/* SLIDE-OVER KERANJANG BELANJA */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-[#0F2A1D]/60 backdrop-blur-xs flex justify-end overscroll-contain"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F6F8F3] w-full max-w-md h-full flex flex-col shadow-2xl border-l border-[#AEC3B0]/50"
            >
              <div className="p-5 bg-white border-b border-[#AEC3B0]/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-base text-[#0F2A1D]">
                    Keranjang Belanja ({totalCartItems})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="w-8 h-8 rounded-full bg-[#F6F8F3] hover:bg-[#E3EED4] text-[#0F2A1D] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3.5">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-full bg-[#E3EED4] text-[#375534] flex items-center justify-center mx-auto mb-3">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <p className="font-extrabold text-sm text-[#0F2A1D] mb-1">
                      Keranjang masih kosong
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
                        className="flex gap-3.5 p-3.5 rounded-2xl bg-white border border-[#AEC3B0]/50 rf-card-shadow"
                      >
                        <img
                          src={thumbUrl}
                          alt={item.product.title}
                          className="w-16 h-16 rounded-xl object-cover bg-[#E3EED4] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] truncate">
                            {item.product.title}
                          </h4>
                          <p className="text-xs font-extrabold text-[#375534] mt-0.5">
                            {formatRupiah(item.product.price)}
                          </p>

                          <div className="flex items-center justify-between mt-3">
                            <div className="inline-flex items-center gap-2 bg-[#E3EED4]/70 border border-[#AEC3B0]/60 rounded-full px-2.5 py-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateCartQty(item.product.id, -1)
                                }
                                className="text-[#0F2A1D] p-0.5"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-extrabold text-[#0F2A1D] w-4 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateCartQty(item.product.id, 1)
                                }
                                className="text-[#0F2A1D] p-0.5"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCartQty(
                                  item.product.id,
                                  -item.quantity
                                )
                              }
                              className="text-[#6B9071] hover:text-red-600 p-1"
                              title="Hapus"
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
                <div className="p-5 bg-white border-t border-[#AEC3B0]/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6B9071]">
                      Total Pembayaran
                    </span>
                    <span className="text-lg font-extrabold text-[#0F2A1D]">
                      {formatRupiah(totalCartPrice)}
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setIsCartOpen(false);
                      router.push('/checkout');
                    }}
                    className="w-full py-3.5 px-5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <span>Lanjut ke Pembayaran QRIS</span>
                    <ArrowRight className="w-4 h-4 text-[#E3EED4]" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}