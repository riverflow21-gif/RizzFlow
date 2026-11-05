'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ShoppingBag,
  KeyRound,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  Copy,
  Check,
  MessageCircle,
  Send,
  Loader2,
  Store,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Category, Product, CartItem, StoreSettings } from '@/types';
import {
  StorefrontTab,
  CatalogFilterType,
  CustomServiceConfig,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
  SubscriptionOrder,
  CART_STORAGE_KEY,
  parseThumbnails,
  parseProductDeliverables,
  formatRupiah,
} from './StorefrontTypes';
import HomeTabView from './HomeTabView';
import ShopTabView from './ShopTabView';
import TrackCodeTabView from './TrackCodeTabView';
import ServicesTabView from './ServicesTabView';
import ProductDetailSheet from './ProductDetailSheet';

interface StorefrontClientProps {
  initialProducts: Product[];
  categories: Category[];
  settings: StoreSettings;
}

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();

  // State Data Utama
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [customService, setCustomService] = useState<CustomServiceConfig>(
    DEFAULT_CUSTOM_SERVICE_CONFIG
  );

  // State Navigasi Multi-Halaman (Home | Shop | Lacak Kode | Layanan)
  const [activeTab, setActiveTab] = useState<StorefrontTab>('home');

  // State Filter Halaman Shop
  const [catalogTypeFilter, setCatalogTypeFilter] =
    useState<CatalogFilterType>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State Detail Produk & Keranjang Belanja
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // State Modal 2 Opsi Produk Langganan & Panduan
  const [subPreorderProduct, setSubPreorderProduct] = useState<Product | null>(
    null
  );
  const [subName, setSubName] = useState<string>('');
  const [subEmail, setSubEmail] = useState<string>('');
  const [subContact, setSubContact] = useState<string>('');
  const [isCreatingSub, setIsCreatingSub] = useState<boolean>(false);
  const [subModalError, setSubModalError] = useState<string | null>(null);
  const [createdSubOrder, setCreatedSubOrder] =
    useState<SubscriptionOrder | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showSubGuideModal, setShowSubGuideModal] = useState<boolean>(false);

  // Segarkan data dari Supabase & ambil konfigurasi Layanan Kustom
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
        // Gunakan konfigurasi default jika gagal memuat
      }
    };

    refreshData();
  }, []);

  // Muat keranjang dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) setCart(parsed);
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

  // Penanganan Tombol Back Bawaan HP & Kunci Scroll Layar Belakang
  const isAnyOverlayOpen = Boolean(
    activeProduct || isCartOpen || subPreorderProduct || showSubGuideModal
  );

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
      if (
        activeProduct ||
        isCartOpen ||
        subPreorderProduct ||
        showSubGuideModal
      ) {
        setActiveProduct(null);
        setIsCartOpen(false);
        setSubPreorderProduct(null);
        setShowSubGuideModal(false);
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handleHardwareBack);
    return () => window.removeEventListener('popstate', handleHardwareBack);
  }, [
    activeProduct,
    isCartOpen,
    subPreorderProduct,
    showSubGuideModal,
    activeTab,
  ]);

  const closeOverlayCleanly = () => {
    setActiveProduct(null);
    setIsCartOpen(false);
    setSubPreorderProduct(null);
    setShowSubGuideModal(false);
    if (window.history.state?.rizzflowOverlay) {
      window.history.back();
    }
  };

  // Pindah tab halaman dengan scroll halus ke atas
  const handleNavigateTab = (tab: StorefrontTab) => {
    if (tab !== 'home' && activeTab === 'home') {
      window.history.pushState({ rizzflowTab: tab }, '');
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lompat dari Beranda ke halaman Shop dengan filter tertentu
  const handleJumpToShopWithFilter = (params: {
    type?: CatalogFilterType;
    categoryId?: string;
    search?: string;
  }) => {
    if (params.type !== undefined) setCatalogTypeFilter(params.type);
    if (params.categoryId !== undefined)
      setSelectedCategoryId(params.categoryId);
    if (params.search !== undefined) setSearchQuery(params.search);
    handleNavigateTab('shop');
  };

  // Fungsi Tambah Produk ke Keranjang (atau Buka Modal 2 Opsi untuk Produk Langganan)
  const handleAddProductWithQuantity = (product: Product, qty: number) => {
    const deliverables = parseProductDeliverables(product.file_path);

    if (deliverables.product_type === 'LANGGANAN') {
      setActiveProduct(null);
      setCreatedSubOrder(null);
      setSubModalError(null);
      setSubPreorderProduct(product);
      return;
    }

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

  // Fungsi membuat Kode Antrian 4 Angka (Opsi 2 Produk Langganan)
  const handleCreateSubscriptionPreorder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPreorderProduct) return;

    setIsCreatingSub(true);
    setSubModalError(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_PREORDER',
          product_id: subPreorderProduct.id,
          customer_name: subName,
          customer_email: subEmail,
          customer_contact: subContact,
        }),
      });

      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        throw new Error(data.error || 'Gagal membuat kode antrian.');
      }

      setCreatedSubOrder(data.subscription);
    } catch (err) {
      setSubModalError(
        err instanceof Error ? err.message : 'Gagal membuat kode antrian.'
      );
    } finally {
      setIsCreatingSub(false);
    }
  };

  const copyCodeToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getWhatsAppUrl = (customText: string): string | null => {
    const rawWa = customService.admin_whatsapp || settings.support_contact || '';
    const digits = rawWa.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const formatted = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(customText)}`;
  };

  const getTelegramUrl = (): string | null => {
    const rawTg = (customService.admin_telegram || '').trim().replace(/^@/, '');
    if (!rawTg) return null;
    return rawTg.startsWith('http') ? rawTg : `https://t.me/${rawTg}`;
  };

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const navItems: {
    id: StorefrontTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'shop', label: 'Shop', icon: Store },
    { id: 'track', label: 'Lacak Kode', icon: KeyRound },
    { id: 'services', label: 'Layanan', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F3] text-[#0F2A1D] flex flex-col pb-24 md:pb-8">
      {/* ==================================================================== */}
      {/* TOP BAR STICKY (Tampil di Desktop untuk Semua Tab, & di HP selain Home) */}
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
              src="/logo.jpg"
              alt={settings.store_name}
              className="h-9 w-9 rounded-xl object-cover border border-[#AEC3B0]/60 shrink-0"
            />
            <span className="font-extrabold text-base sm:text-lg text-[#0F2A1D] truncate">
              {settings.store_name}
            </span>
          </button>

          {/* Menu Kapsul Tengah Khusus Layar Desktop/Laptop */}
          <nav className="hidden md:flex items-center gap-1.5 bg-white p-1.5 rounded-full border border-[#AEC3B0]/50 rf-card-shadow">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigateTab(item.id)}
                  className={
                    isActive
                      ? 'px-4 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs inline-flex items-center gap-1.5 transition-all'
                      : 'px-4 py-1.5 rounded-full text-[#6B9071] hover:text-[#0F2A1D] font-bold text-xs inline-flex items-center gap-1.5 transition-all'
                  }
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tombol Keranjang Belanja di Kanan Atas */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsCartOpen(true)}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/60 rf-card-shadow transition-colors shrink-0"
            aria-label="Keranjang Belanja"
          >
            <ShoppingBag className="w-4 h-4 text-[#375534]" />
            <span className="text-xs font-extrabold hidden sm:inline">
              Keranjang
            </span>
            {totalCartItems > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-[10px] font-extrabold">
                {totalCartItems}
              </span>
            )}
          </motion.button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* AREA KONTEN 4 HALAMAN DENGAN ANIMASI TRANSISI HALUS */}
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
                totalCartItems={totalCartItems}
                addedProductId={addedProductId}
                onOpenCart={() => setIsCartOpen(true)}
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
                catalogTypeFilter={catalogTypeFilter}
                onChangeCatalogType={setCatalogTypeFilter}
                selectedCategoryId={selectedCategoryId}
                onChangeCategoryId={setSelectedCategoryId}
                searchQuery={searchQuery}
                onChangeSearchQuery={setSearchQuery}
                addedProductId={addedProductId}
                onSelectProduct={(p) => setActiveProduct(p)}
                onAddToCart={(p) => handleAddProductWithQuantity(p, 1)}
                onOpenSubGuide={() => setShowSubGuideModal(true)}
              />
            </motion.div>
          )}

          {activeTab === 'track' && (
            <motion.div
              key="tab-track"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TrackCodeTabView
                initialOrder={createdSubOrder}
                whatsappUrl={getWhatsAppUrl(
                  'Halo Admin RizzFlow, saya ingin menanyakan status kode antrian langganan saya.'
                )}
                telegramUrl={getTelegramUrl()}
                onJumpToSubscriptionCatalog={() =>
                  handleJumpToShopWithFilter({ type: 'LANGGANAN' })
                }
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
      {/* FLOATING BOTTOM NAVIGATION BAR (GAYA GAMBAR 1 & GAMBAR 2) */}
      {/* ==================================================================== */}
      <div className="fixed bottom-4 inset-x-4 z-30 md:hidden flex justify-center pointer-events-none">
        <nav className="bg-white/95 backdrop-blur-md border border-[#AEC3B0]/60 rounded-full p-1.5 rf-bottom-bar-shadow flex items-center justify-between gap-1 w-full max-w-sm pointer-events-auto">
          {navItems.map((item) => {
            const IconComp = item.icon;
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
                    : 'flex-1 py-2.5 px-2 rounded-full text-[#6B9071] hover:text-[#0F2A1D] font-bold text-xs flex items-center justify-center gap-1 transition-all'
                }
              >
                <IconComp
                  className={
                    isActive
                      ? 'w-4 h-4 stroke-[2.4] text-[#0F2A1D] shrink-0'
                      : 'w-4 h-4 stroke-[2] shrink-0'
                  }
                />
                <span className={isActive ? 'inline' : 'hidden xs:inline'}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* ==================================================================== */}
      {/* LEMBARAN DETAIL PRODUK 2/3 LAYAR (GAMBAR 1 KANAN & GAMBAR 2 KANAN) */}
      {/* ==================================================================== */}
      <ProductDetailSheet
        product={activeProduct}
        storeName={settings.store_name}
        onClose={closeOverlayCleanly}
        onAddWithQuantity={(prod, qty) => {
          handleAddProductWithQuantity(prod, qty);
          if (
            parseProductDeliverables(prod.file_path).product_type !==
            'LANGGANAN'
          ) {
            setActiveProduct(null);
            setIsCartOpen(true);
          }
        }}
      />

      {/* ==================================================================== */}
      {/* MODAL 2 OPSI PEMBELIAN PRODUK LANGGANAN (CHAT WA/TELE ATAU 4 ANGKA) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {subPreorderProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-[#0F2A1D]/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F6F8F3] w-full max-w-md rounded-[28px] p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 border border-[#AEC3B0]"
            >
              <div className="flex items-center justify-between border-b border-[#AEC3B0]/50 pb-3">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#0F2A1D] text-[#E3EED4]">
                  👑 Opsi Pembelian Produk Langganan
                </span>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="w-8 h-8 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!createdSubOrder ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-white border border-[#AEC3B0]/50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] truncate">
                        {subPreorderProduct.title}
                      </h3>
                      <p className="text-xs sm:text-sm font-extrabold text-[#375534]">
                        {formatRupiah(subPreorderProduct.price)}
                      </p>
                    </div>
                  </div>

                  {/* OPSI 1: HUBUNGI ADMIN LANGSUNG VIA WA / TELEGRAM */}
                  <div className="p-4 rounded-2xl bg-[#E3EED4] border border-[#6B9071]/50 space-y-2.5">
                    <div className="text-xs font-extrabold text-[#0F2A1D]">
                      OPSI 1 — Hubungi Admin Langsung (Respon Cepat)
                    </div>
                    <p className="text-[11px] text-[#375534] leading-relaxed">
                      Ingin cek stok dan bertransaksi langsung lewat chat? Klik tombol WhatsApp atau Telegram Admin di bawah ini:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {getWhatsAppUrl(
                        `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (${formatRupiah(subPreorderProduct.price)}). Apakah stoknya tersedia saat ini?`
                      ) ? (
                        <a
                          href={
                            getWhatsAppUrl(
                              `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (${formatRupiah(subPreorderProduct.price)}). Apakah stoknya tersedia saat ini?`
                            )!
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat WhatsApp</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#375534] italic">
                          (Nomor WA belum diatur di Admin)
                        </span>
                      )}

                      {getTelegramUrl() && (
                        <a
                          href={getTelegramUrl()!}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>Chat Telegram</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="relative flex py-0.5 items-center">
                    <div className="flex-grow border-t border-[#AEC3B0]" />
                    <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-[#6B9071]">
                      ATAU LANJUT DI WEBSITE
                    </span>
                    <div className="flex-grow border-t border-[#AEC3B0]" />
                  </div>

                  {/* OPSI 2: AMBIL KODE 4 ANGKA & BALASAN VIA EMAIL */}
                  <form
                    onSubmit={handleCreateSubscriptionPreorder}
                    className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-3"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-[#0F2A1D]">
                        OPSI 2 — Ambil Kode 4 Angka (Balasan Email &amp; Bayar di Web)
                      </div>
                      <p className="text-[11px] text-[#6B9071] mt-0.5 leading-relaxed">
                        Ambil Kode Antrian 4 Angka tanpa bayar di awal. Admin akan mengirim konfirmasi stok ke emailmu (maks 2 jam) dan kamu bisa lanjut bayar QRIS di menu Lacak Kode.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Nama Kamu *"
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-xs sm:text-sm text-[#0F2A1D]"
                      />
                      <input
                        type="email"
                        required
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        placeholder="Alamat Email Aktif * (Untuk terima balasan)"
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-xs sm:text-sm text-[#0F2A1D]"
                      />
                      <input
                        type="text"
                        value={subContact}
                        onChange={(e) => setSubContact(e.target.value)}
                        placeholder="Nomor WhatsApp (Opsional)"
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-xs sm:text-sm text-[#0F2A1D]"
                      />
                    </div>

                    {subModalError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                        {subModalError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isCreatingSub}
                      className="w-full py-3 px-4 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isCreatingSub ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Membuat Kode 4 Angka...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 text-[#E3EED4]" />
                          <span>Ambil Kode 4 Angka Sekarang</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="p-5 rounded-2xl bg-[#E3EED4] border-2 border-[#375534]">
                    <span className="text-xs font-extrabold text-[#375534] uppercase">
                      Kode Antrian 4 Angka Kamu:
                    </span>
                    <div className="text-4xl font-extrabold tracking-widest text-[#0F2A1D] my-2">
                      {createdSubOrder.code}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCodeToClipboard(createdSubOrder.code)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-bold"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Kode Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Kode 4 Angka</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#AEC3B0] text-left text-xs text-[#0F2A1D] space-y-1">
                    <p className="font-extrabold text-[#375534]">
                      ⚠️ PENTING: Simpan atau ingat 4 angka di atas!
                    </p>
                    <p className="text-[#6B9071]">
                      Kami akan mengirimkan email ke{' '}
                      <strong className="text-[#0F2A1D]">
                        {createdSubOrder.customer_email}
                      </strong>{' '}
                      begitu stok dikonfirmasi Admin.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSubPreorderProduct(null);
                      handleNavigateTab('track');
                    }}
                    className="w-full py-3.5 px-4 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white font-extrabold text-xs sm:text-sm transition-colors"
                  >
                    Buka Halaman Lacak Kode Sekarang →
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL PANDUAN RINGKAS PRODUK LANGGANAN */}
      <AnimatePresence>
        {showSubGuideModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-[#0F2A1D]/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F6F8F3] w-full max-w-md rounded-[28px] p-6 shadow-2xl space-y-4 border border-[#AEC3B0]"
            >
              <div className="flex items-center justify-between border-b border-[#AEC3B0]/50 pb-3">
                <h3 className="font-extrabold text-base text-[#0F2A1D]">
                  Panduan Pembelian Produk Langganan
                </h3>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="w-8 h-8 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#0F2A1D] leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-[#E3EED4] border border-[#6B9071]/40">
                  <strong>Opsi 1: Chat Langsung via WhatsApp / Telegram</strong>
                  <p className="text-[#375534] mt-1">
                    Ketuk produk bertanda 👑 Langganan, lalu pilih tombol WhatsApp atau Telegram untuk langsung bertransaksi dengan Admin.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#AEC3B0]/60">
                  <strong>Opsi 2: Ambil Kode Antrian 4 Angka di Website</strong>
                  <p className="text-[#375534] mt-1">
                    Ambil Kode 4 Angka gratis tanpa bayar di awal. Saat Admin mengonfirmasi stok tersedia (maksimal 2 jam), kamu menerima notif email dan bisa langsung membayar via QRIS di menu <strong>Lacak Kode</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeOverlayCleanly}
                className="w-full py-3 rounded-full bg-[#0F2A1D] text-white font-extrabold text-xs"
              >
                Mengerti
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* SLIDE-OVER KERANJANG BELANJA (BOTANICAL FOREST & SAGE) */}
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
                    <p className="text-xs text-[#6B9071]">
                      Pilih produk digital instan dari katalog untuk mulai berbelanja.
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