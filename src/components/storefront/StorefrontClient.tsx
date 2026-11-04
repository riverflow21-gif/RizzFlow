'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  ArrowRight,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Images,
  Zap,
  ShieldCheck,
  QrCode,
  UserCheck,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  MessageSquarePlus,
  MailCheck,
  MousePointerClick,
} from 'lucide-react';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
  CustomServiceConfig,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
} from '@/lib/supabase';
import { Category, Product, CartItem, StoreSettings } from '@/types';

interface StorefrontClientProps {
  initialProducts: Product[];
  categories: Category[];
  settings: StoreSettings;
}

const CART_STORAGE_KEY = 'rizzflow_cart_v1';
const PRODUCTS_PER_SLIDE = 6; // Maksimal 6 produk per halaman/slide
const VISIBLE_CATEGORY_LIMIT = 5; // Batas kategori sebelum dilipat ke tombol "Lainnya..."

const OLD_DEFAULT_DESC =
  'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.';
const NEW_GENERAL_DESC =
  'Solusi Produk Digital Instan, Praktis, dan Berkualitas. Dapatkan berbagai koleksi e-book, dokumen, template, hingga layanan pembuatan kustom sesuai kebutuhanmu.';

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara menerima file produk setelah saya membayar QRIS?',
    a: 'Begitu kamu selesai membayar kode QRIS, sistem otomatis RizzFlow langsung mendeteksi pembayaranmu dalam hitungan detik dan mengirimkan link unduhan produk ke alamat email yang kamu isi saat Checkout.',
  },
  {
    q: 'Apakah saya harus daftar akun atau login terlebih dahulu?',
    a: 'Tidak perlu! Kamu bisa langsung belanja tanpa buat akun (Guest Checkout). Cukup pilih produk, masukkan email aktifmu, dan bayar via QRIS.',
  },
  {
    q: 'Bagaimana cara klaim garansi jika file belum masuk ke email?',
    a: 'Setiap pembelian bergaransi 100%! Cukup isi Canvas Klaim Garansi di samping/bawah ini dengan mencantumkan email atau nomor invoice-mu. Notifikasi akan langsung berbunyi di perangkat Admin kami.',
  },
  {
    q: 'Bagaimana cara memesan Layanan Kustom (Pembuatan Web / Template Excel / Lainnya)?',
    a: 'Klik tombol "Pesan Layanan Kustom" di atas atau langsung pilih tab "Jasa Kustom" pada Canvas Pesan di bawah, lalu tuliskan kebutuhanmu. Admin kami akan segera menghubungi kamu.',
  },
];

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();
  const canvasFormRef = useRef<HTMLDivElement | null>(null);
  const catalogTopRef = useRef<HTMLDivElement | null>(null);

  // State data produk, kategori, pengaturan, & layanan kustom
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [customService, setCustomService] = useState<CustomServiceConfig>(
    DEFAULT_CUSTOM_SERVICE_CONFIG
  );

  // State pencarian, kategori, lipatan kategori, & nomor slide produk
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(1);

  // State detail produk, keranjang, dan FAQ
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // State Canvas Formulir Klaim Garansi & Pesan Layanan Khusus
  const [msgType, setMsgType] = useState<
    'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN'
  >('KLAIM_GARANSI');
  const [senderName, setSenderName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [senderContact, setSenderContact] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isSendingMsg, setIsSendingMsg] = useState<boolean>(false);
  const [msgFeedback, setMsgFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const bannerDescription =
    !settings.banner_description || settings.banner_description === OLD_DEFAULT_DESC
      ? NEW_GENERAL_DESC
      : settings.banner_description;

  // Segarkan data katalog & layanan kustom setiap kali halaman dibuka
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
        // Gunakan default jika gagal memuat
      }
    };

    refreshStorefrontData();
  }, []);

  // Reset slide kembali ke halaman 1 setiap kali kata kunci pencarian atau kategori berubah
  useEffect(() => {
    setCurrentSlide(1);
  }, [searchQuery, selectedCategoryId]);

  // Penanganan Tombol Back Bawaan HP & Kunci Scroll Layar Belakang
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
    const handleHardwareBackButton = () => {
      setActiveProduct(null);
      setIsCartOpen(false);
    };

    window.addEventListener('popstate', handleHardwareBackButton);
    return () => window.removeEventListener('popstate', handleHardwareBackButton);
  }, []);

  const closeOverlayCleanly = () => {
    setActiveProduct(null);
    setIsCartOpen(false);
    if (window.history.state?.rizzflowOverlay) {
      window.history.back();
    }
  };

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

  const handleAddToCart = (product: Product) => {
    const primaryThumb =
      parseThumbnails(product.thumbnail_url)[0] || product.thumbnail_url;
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

  const handleJumpToCustomServiceCanvas = () => {
    setMsgType('LAYANAN_KHUSUS');
    if (!messageText.trim()) {
      setMessageText(
        'Halo Admin RizzFlow, saya ingin memesan Layanan Kustom. Berikut detail kebutuhan saya: '
      );
    }
    canvasFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSendCanvasMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgFeedback(null);
    setIsSendingMsg(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msgType,
          sender_name: senderName,
          sender_email: senderEmail,
          sender_contact: senderContact,
          invoice_number: invoiceNumber,
          message: messageText,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan.');
      }

      setMsgFeedback({
        type: 'success',
        text:
          data.message ||
          'Pesan berhasil terkirim ke Admin! Kami akan segera menghubungi kamu.',
      });
      setSenderName('');
      setInvoiceNumber('');
      setMessageText('');
    } catch (err) {
      setMsgFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim pesan.',
      });
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Filter produk berdasarkan pencarian & kategori
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

  // Logika Slide Produk (Maksimal 6 Produk per Slide)
  const totalSlides = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_SLIDE)
  );
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentSlide - 1) * PRODUCTS_PER_SLIDE;
    return filteredProducts.slice(startIdx, startIdx + PRODUCTS_PER_SLIDE);
  }, [filteredProducts, currentSlide]);

  // Logika Lipatan Kategori ("Lainnya...")
  const displayedCategories = showAllCategories
    ? categories
    : categories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const hiddenCategoryCount = Math.max(
    0,
    categories.length - VISIBLE_CATEGORY_LIMIT
  );

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const activeProductImages = useMemo(
    () => (activeProduct ? parseThumbnails(activeProduct.thumbnail_url) : []),
    [activeProduct]
  );

  const activeProductOriginalPrice = useMemo(() => {
    if (!activeProduct) return null;
    return parseProductDeliverables(activeProduct.file_path).original_price || null;
  }, [activeProduct]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] flex flex-col overflow-x-hidden">
      {/* Bilah Navigasi Atas */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-15 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.jpg"
              alt={settings.store_name}
              className="h-9 w-auto rounded-lg object-contain shadow-xs shrink-0"
            />
            <span className="font-bold text-base sm:text-lg tracking-tight text-[#0F172A] truncate">
              {settings.store_name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                canvasFormRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#059669] bg-[#ECFDF5] hover:bg-emerald-100 transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Bantuan & Jasa Kustom</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200/80 transition-colors"
              aria-label="Buka Keranjang Belanja"
            >
              <ShoppingBag className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">
                Keranjang
              </span>
              {totalCartItems > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-[#10B981] text-white">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Konten Utama Katalog Toko (Lebih Padat & Ringkas) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-8 space-y-6">
        {/* Banner Sambutan + 4 Keunggulan Ringkas (Tanpa Sub-Teks) */}
        <section className="space-y-3">
          <div className="bg-gradient-to-br from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-100 rounded-2xl p-5 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight mb-1.5">
              Semua Kebutuhan Produk Digitalmu di Satu Tempat
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl leading-relaxed break-words">
              {bannerDescription}
            </p>
          </div>

          {/* 4 Keunggulan Web Pendek & Ringkas */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <Zap className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>Pengiriman Instan</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <QrCode className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>QRIS Resmi</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <UserCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>Tanpa Daftar Akun</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>Bergaransi 100%</span>
            </div>
          </div>
        </section>

        {/* Pencarian, Kategori Berurut ke Bawah ("Lainnya..."), & Slide Produk (Maks 6) */}
        <section ref={catalogTopRef} className="space-y-4">
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari e-book, template, atau produk digital..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Daftar Kategori Kecil Berurut ke Bawah + Tombol "Lainnya..." */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCategoryId === 'ALL'
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-slate-200/80'
                }`}
              >
                Semua ({products.length})
              </button>

              {displayedCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-slate-200/80'
                  }`}
                >
                  {cat.name}
                </button>
              ))}

              {hiddenCategoryCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold text-[#059669] bg-[#ECFDF5] hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  {showAllCategories
                    ? 'Sembunyikan'
                    : `Lainnya... (+${hiddenCategoryCount})`}
                </button>
              )}
            </div>
          </div>

          {/* Grid Katalog Produk (Maksimal 6 Produk per Slide) */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 px-4">
              <FileText className="w-9 h-9 text-[#64748B] mx-auto mb-2 stroke-[1.5]" />
              <p className="font-semibold text-sm text-[#0F172A] mb-0.5">
                Produk tidak ditemukan
              </p>
              <p className="text-xs text-[#64748B]">
                Coba kata kunci lain atau pilih kategori Semua.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`slide-${currentSlide}-${selectedCategoryId}-${searchQuery}`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
                >
                  {paginatedProducts.map((product) => {
                    const isAdded = addedProductId === product.id;
                    const thumbList = parseThumbnails(product.thumbnail_url);
                    const coverThumb = thumbList[0] || '';
                    const deliverables = parseProductDeliverables(product.file_path);
                    const origPrice = deliverables.original_price;
                    const hasDiscount =
                      typeof origPrice === 'number' && origPrice > product.price;
                    const savePercent = hasDiscount
                      ? Math.round(((origPrice - product.price) / origPrice) * 100)
                      : 0;

                    return (
                      <div
                        key={product.id}
                        className="group bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col min-w-0"
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
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-emerald-200 shadow-xs">
                                {product.badge}
                              </span>
                            )}
                            {hasDiscount && savePercent > 0 && (
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white">
                                -{savePercent}%
                              </span>
                            )}
                            {thumbList.length > 1 && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/70 text-white inline-flex items-center gap-1">
                                <Images className="w-3 h-3" />
                                <span>{thumbList.length}</span>
                              </span>
                            )}
                          </div>

                          <div className="p-3 sm:p-3.5 flex-1 flex flex-col min-w-0">
                            <h2 className="font-bold text-xs sm:text-sm text-[#0F172A] line-clamp-2 break-words mb-1 group-hover:text-[#059669] transition-colors">
                              {product.title}
                            </h2>
                            <p className="text-[11px] text-[#64748B] line-clamp-1 break-words mb-2 flex-1">
                              {product.description}
                            </p>

                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm text-[#10B981]">
                                Rp{product.price.toLocaleString('id-ID')}
                              </span>
                              {hasDiscount && (
                                <span className="text-[10px] text-[#64748B] line-through">
                                  Rp{origPrice.toLocaleString('id-ID')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="px-3 pb-3 sm:px-3.5 sm:pb-3.5">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product)}
                            className={`w-full py-2 px-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-all ${
                              isAdded
                                ? 'bg-[#059669] text-white'
                                : 'bg-[#10B981] hover:bg-[#059669] text-white'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Ditambahkan</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Keranjang</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Navigasi Slide Halaman Produk (Muncul Jika Produk Lebih dari 6) */}
              {totalSlides > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1 bg-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    disabled={currentSlide === 1}
                    onClick={() => {
                      setCurrentSlide((p) => Math.max(1, p - 1));
                      catalogTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#0F172A] disabled:opacity-40 hover:border-[#10B981] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-[#0F172A]">
                      Slide {currentSlide} / {totalSlides}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={currentSlide === totalSlides}
                    onClick={() => {
                      setCurrentSlide((p) => Math.min(totalSlides, p + 1));
                      catalogTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#0F172A] disabled:opacity-40 hover:border-[#10B981] transition-colors"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================================================================== */}
        {/* LAYANAN KUSTOM RINGKAS (1 KARTU + 1 TOMBOL + DIATUR DARI ADMIN) */}
        {/* ================================================================== */}
        <section className="bg-gradient-to-r from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-200/80 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#059669]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Layanan Kustom RizzFlow</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] break-words">
                {customService.title}
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed break-words">
                {customService.description}
              </p>

              {/* Daftar Layanan Tersedia dalam Bentuk Chip Ringkas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customService.services.map((srv, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-[#0F172A]"
                  >
                    <Check className="w-3 h-3 text-[#10B981] shrink-0" />
                    <span>{srv}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={handleJumpToCustomServiceCanvas}
                className="w-full md:w-auto px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 transition-all"
              >
                <span>Pesan Layanan Kustom</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* CARA BELANJA KREATIF, BERANIMASI, HIDUP & RINGKAS */}
        {/* ================================================================== */}
        <section className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 overflow-hidden relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="sm:max-w-[200px] shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                ⚡ Otomatis 24/7
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                3 Langkah Instan Belanja di RizzFlow
              </h2>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 relative">
              {/* Garis Animasi Penghubung di Belakang */}
              <div className="hidden sm:block absolute top-5 left-12 right-12 h-0.5 bg-slate-700 overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'linear' }}
                  className="w-1/2 h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                />
              </div>

              {/* Langkah 1 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5 shadow-md shadow-emerald-500/30"
                >
                  <MousePointerClick className="w-4 h-4" />
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  1. Pilih Produk
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  Masukkan keranjang
                </span>
              </motion.div>

              {/* Langkah 2 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 0.6 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5 shadow-md shadow-emerald-500/30"
                >
                  <QrCode className="w-4 h-4" />
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  2. Scan QRIS
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  Isi email & bayar
                </span>
              </motion.div>

              {/* Langkah 3 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 1.2 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5 shadow-md shadow-emerald-500/30"
                >
                  <MailCheck className="w-4 h-4" />
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  3. Cek Emailmu!
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  File langsung masuk
                </span>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* TANYA JAWAB (FAQ) & CANVAS KLAIM GARANSI / PESAN KHUSUS */}
        {/* ================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Kolom Kiri: Tanya Jawab (FAQ) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3.5">
              <HelpCircle className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Tanya Jawab (FAQ)
              </h2>
            </div>

            <div className="space-y-2">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200/80 overflow-hidden bg-[#F8FAFC]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left flex items-center justify-between gap-2 font-bold text-xs text-[#0F172A]"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${
                          isOpen ? 'rotate-180 text-[#10B981]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 text-xs text-[#64748B] leading-relaxed border-t border-slate-100 pt-2.5 bg-white">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Canvas Formulir Klaim Garansi & Request Layanan Kustom */}
          <div
            ref={canvasFormRef}
            className="lg:col-span-7 bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquarePlus className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Canvas Klaim Garansi & Pesan Layanan Kustom
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mb-4">
              Ada kendala pengiriman file atau ingin pesan jasa pembuatan kustom? Kirim pesan di bawah ini.
            </p>

            <form onSubmit={handleSendCanvasMessage} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMsgType('KLAIM_GARANSI')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    msgType === 'KLAIM_GARANSI'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#F8FAFC] text-[#64748B] border-slate-200'
                  }`}
                >
                  🛡️ Klaim Garansi
                </button>
                <button
                  type="button"
                  onClick={() => setMsgType('LAYANAN_KHUSUS')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    msgType === 'LAYANAN_KHUSUS'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#F8FAFC] text-[#64748B] border-slate-200'
                  }`}
                >
                  ✨ Jasa Kustom
                </button>
                <button
                  type="button"
                  onClick={() => setMsgType('PERTANYAAN')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    msgType === 'PERTANYAAN'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#F8FAFC] text-[#64748B] border-slate-200'
                  }`}
                >
                  💬 Tanya Admin
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Nama Kamu *"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
                />
                <input
                  type="email"
                  required
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="Email Aktif Kamu *"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="No. WhatsApp (Opsional)"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
                />
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="No. Invoice (Jika Klaim Garansi)"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <textarea
                rows={3}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={
                  msgType === 'KLAIM_GARANSI'
                    ? 'Jelaskan kendalamu (misal: Pembayaran QRIS sukses tapi file belum masuk)...'
                    : 'Tuliskan detail website sederhana / template Excel kustom yang ingin kamu buat...'
                }
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
              />

              {msgFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    msgFeedback.type === 'success'
                      ? 'bg-[#ECFDF5] text-[#059669] border border-emerald-200'
                      : 'bg-red-50 text-[#EF4444] border border-red-200'
                  }`}
                >
                  {msgFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{msgFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingMsg}
                className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isSendingMsg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Pesan ke Admin</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
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

      {/* Modal Detail Produk (Tinggi 2/3 Layar, Gambar Ikut Ter-scroll, Tombol Back HP Aktif) */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl h-[66vh] sm:h-[68vh] flex flex-col touch-auto"
            >
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />
              <button
                type="button"
                onClick={closeOverlayCleanly}
                className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md hover:bg-white border border-slate-200/70"
                aria-label="Tutup Detail Produk"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="relative aspect-[16/10] bg-[#F8FAFC] border-b border-slate-100">
                  <img
                    src={activeProductImages[activeImageIndex] || ''}
                    alt={activeProduct.title}
                    className="w-full h-full object-cover"
                  />

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
                      <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-xs font-bold">
                        {activeImageIndex + 1} / {activeProductImages.length}
                      </span>
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
                </div>

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

                <div className="p-5 sm:p-6 space-y-3.5">
                  {activeProduct.badge && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669]">
                      {activeProduct.badge}
                    </span>
                  )}
                  <h3 className="text-xl font-extrabold text-[#0F172A] break-words">
                    {activeProduct.title}
                  </h3>

                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-extrabold text-[#10B981]">
                      Rp{activeProduct.price.toLocaleString('id-ID')}
                    </span>
                    {activeProductOriginalPrice &&
                      activeProductOriginalPrice > activeProduct.price && (
                        <span className="text-sm text-[#64748B] line-through">
                          Rp{activeProductOriginalPrice.toLocaleString('id-ID')}
                        </span>
                      )}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                      Deskripsi Produk Digital
                    </h4>
                    <p className="text-sm text-[#0F172A] whitespace-pre-line leading-relaxed break-words">
                      {activeProduct.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-[#F8FAFC] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(activeProduct);
                    setActiveProduct(null);
                    setIsCartOpen(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm transition-colors shadow-sm"
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
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end overscroll-contain"
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
                  onClick={closeOverlayCleanly}
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
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
      <footer className="border-t border-slate-100 py-5 text-xs text-[#64748B] bg-[#F8FAFC] mt-8">
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