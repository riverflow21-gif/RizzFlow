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
  Globe,
  FileSpreadsheet,
  Presentation,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  MessageSquarePlus,
} from 'lucide-react';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
} from '@/lib/supabase';
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
  'Solusi Produk Digital Instan, Praktis, dan Berkualitas. Dapatkan berbagai koleksi e-book, dokumen, template, hingga layanan pembuatan kustom sesuai kebutuhanmu.';

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara menerima file produk setelah saya membayar QRIS?',
    a: 'Begitu kamu selesai memindai dan membayar kode QRIS, sistem otomatis RizzFlow akan langsung mendeteksi pembayaranmu dalam hitungan detik dan mengirimkan link unduhan produk langsung ke alamat email yang kamu isi saat Checkout.',
  },
  {
    q: 'Apakah saya harus mendaftar akun atau login terlebih dahulu untuk membeli?',
    a: 'Tidak perlu! Di RizzFlow kamu bisa langsung belanja tanpa ribet membuat akun (Guest Checkout). Cukup pilih produk, masukkan email aktifmu, dan bayar via QRIS.',
  },
  {
    q: 'Bagaimana cara klaim garansi jika file belum masuk ke email atau ada kendala?',
    a: 'Tenang, setiap pembelian di RizzFlow bergaransi 100%! Kamu cukup mengisi Canvas Pengaduan & Klaim Garansi yang tersedia di bagian bawah halaman ini dengan mencantumkan email atau nomor invoice-mu. Pesanmu akan langsung membunyikan notifikasi di perangkat Admin kami untuk segera dikirim ulang.',
  },
  {
    q: 'Apakah RizzFlow menerima jasa pembuatan Website sederhana atau Template Excel sesuai permintaan (Custom)?',
    a: 'Ya! Selain menjual produk siap unduh di katalog, kami membuka Layanan Khusus pembuatan Website Sederhana (Landing Page, Web Profil/UMKM, Katalog), pembuatan Template Excel/Spreadsheet kustom (rumus otomatis, pembukuan, kasir), serta pembuatan Slide PPT/Dokumen. Silakan gunakan Canvas Pesan di bawah halaman ini dan pilih kategori "Pesan Layanan Khusus".',
  },
];

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();
  const canvasFormRef = useRef<HTMLDivElement | null>(null);

  // State data produk & kategori
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);

  // State pencarian, kategori aktif, modal detail produk, galeri foto, keranjang, dan FAQ
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
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

  // ==========================================================================
  // PERBAIKAN POIN 8: TOMBOL KEMBALI (BACK BUTTON) BAWAAN HP & KUNCI SCROLL
  // ==========================================================================
  const isAnyOverlayOpen = Boolean(activeProduct || isCartOpen);

  useEffect(() => {
    if (isAnyOverlayOpen) {
      document.body.style.overflow = 'hidden';
      // Tambahkan penanda riwayat agar tombol Back di HP menutup pop-up, bukan keluar dari web
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
      // Saat tombol Back di HP ditekan, tutup detail produk atau keranjang
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

  // Fungsi mengarahkan pengunjung ke Canvas Form dengan pilihan Layanan Khusus otomatis terpilih
  const scrollToCanvasWithService = (serviceName: string) => {
    setMsgType('LAYANAN_KHUSUS');
    setMessageText(`Halo Admin RizzFlow, saya tertarik memesan ${serviceName}. Detail kebutuhan saya: `);
    canvasFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Fungsi mengirim pesan dari Canvas ke Admin & Notifikasi HP
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

  const activeProductOriginalPrice = useMemo(() => {
    if (!activeProduct) return null;
    return parseProductDeliverables(activeProduct.file_path).original_price || null;
  }, [activeProduct]);

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

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                canvasFormRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#059669] bg-[#ECFDF5] hover:bg-emerald-100 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Klaim Garansi & Jasa Kustom</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200/80 transition-colors"
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
        </div>
      </header>

      {/* Konten Utama Katalog Toko */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10 space-y-10">
        {/* Banner Sambutan (Tanpa Baris Teks Lama yang Dihapus) + 4 Kartu Trust Badges */}
        <section className="space-y-4">
          <div className="bg-gradient-to-br from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-100 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mb-2.5">
              Semua Kebutuhan Produk Digitalmu di Satu Tempat
            </h1>
            <p className="text-sm sm:text-base text-[#64748B] max-w-2xl leading-relaxed break-words">
              {bannerDescription}
            </p>
          </div>

          {/* REKOMENDASI 1: Baris Jaminan Keunggulan (Trust Badges Strip) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  Pengiriman Instan
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  Otomatis masuk ke emailmu
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  QRIS Resmi & Cepat
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  Semua M-Banking & E-Wallet
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  Tanpa Daftar Akun
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  Praktis langsung checkout
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  Bergaransi 100%
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  Klaim mudah langsung di web
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kolom Pencarian, Filter Kategori, & Grid Katalog Produk */}
        <section className="space-y-5">
          <div className="space-y-4">
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
          </div>

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
                const deliverables = parseProductDeliverables(product.file_path);
                const origPrice = deliverables.original_price;
                const hasDiscount =
                  typeof origPrice === 'number' && origPrice > product.price;
                const savePercent = hasDiscount
                  ? Math.round(((origPrice - product.price) / origPrice) * 100)
                  : 0;

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
                        {hasDiscount && savePercent > 0 && (
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white shadow-xs">
                            -{savePercent}%
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

                        {/* REKOMENDASI 2: Tampilan Harga Coret (Harga Asli vs Harga Promo) */}
                        <div className="space-y-0.5">
                          {hasDiscount && (
                            <div className="text-[11px] text-[#64748B] line-through">
                              Rp{origPrice.toLocaleString('id-ID')}
                            </div>
                          )}
                          <div className="font-extrabold text-sm sm:text-base text-[#10B981]">
                            Rp{product.price.toLocaleString('id-ID')}
                          </div>
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
        </section>

        {/* ================================================================== */}
        {/* POIN 6: SEKSI LAYANAN KHUSUS / CUSTOM ORDER (WEB, EXCEL, PPT/TOOLS) */}
        {/* ================================================================== */}
        <section className="bg-gradient-to-br from-[#F8FAFC] to-[#ECFDF5]/50 border border-emerald-200/80 rounded-2xl p-6 sm:p-8">
          <div className="max-w-2xl mb-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669] border border-emerald-200 mb-2">
              ✨ Layanan Kustom RizzFlow
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-2">
              Butuh Website Sederhana atau Template Sesuai Permintaanmu?
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Selain produk siap unduh di atas, kami juga menerima pembuatan sistem dan dokumen digital kustom yang dirancang khusus mengikuti kebutuhan tugas, bisnis, atau usahamu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mb-3">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-[#0F172A] mb-1.5">
                  Pembuatan Web Sederhana
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Pembuatan Landing Page promosi, website profil UMKM, halaman portofolio, atau mini-web katalog yang responsif di HP.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  scrollToCanvasWithService('Jasa Pembuatan Website Sederhana / Landing Page')
                }
                className="w-full py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#10B981] text-[#059669] hover:text-white border border-emerald-200 font-bold text-xs transition-colors"
              >
                Request Pembuatan Web →
              </button>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-[#0F172A] mb-1.5">
                  Template Excel Kustom
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Pembuatan tabel pembukuan otomatis, laporan kasir, hitung HPP, stok barang, hingga rumus Excel/Spreadsheet sesuai permintaanmu.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  scrollToCanvasWithService('Jasa Pembuatan Template Excel Kustom')
                }
                className="w-full py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#10B981] text-[#059669] hover:text-white border border-emerald-200 font-bold text-xs transition-colors"
              >
                Request Template Excel →
              </button>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mb-3">
                  <Presentation className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-[#0F172A] mb-1.5">
                  Slide PPT, Dokumen & Tools AI
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Pembuatan slide presentasi profesional, template workspace Notion, kalkulator web interaktif, atau dokumen siap pakai lainnya.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  scrollToCanvasWithService('Jasa Slide PPT / Dokumen / Tools Digital Kustom')
                }
                className="w-full py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#10B981] text-[#059669] hover:text-white border border-emerald-200 font-bold text-xs transition-colors"
              >
                Request Layanan Ini →
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* REKOMENDASI 3A: CARA PEMBELIAN DALAM 3 LANGKAH MUDAH */}
        {/* ================================================================== */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] text-center mb-6">
            Cara Belanja Mudah dalam 3 Langkah
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-100 text-center">
              <div className="w-8 h-8 rounded-full bg-[#10B981] text-white font-extrabold text-sm flex items-center justify-center mx-auto mb-2.5">
                1
              </div>
              <h3 className="font-bold text-sm text-[#0F172A] mb-1">
                Pilih Produk Digital
              </h3>
              <p className="text-xs text-[#64748B]">
                Masukkan produk pilihanmu ke keranjang dan klik tombol Lanjut ke Checkout.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-100 text-center">
              <div className="w-8 h-8 rounded-full bg-[#10B981] text-white font-extrabold text-sm flex items-center justify-center mx-auto mb-2.5">
                2
              </div>
              <h3 className="font-bold text-sm text-[#0F172A] mb-1">
                Isi Email & Bayar QRIS
              </h3>
              <p className="text-xs text-[#64748B]">
                Masukkan email aktifmu (tanpa perlu buat akun) lalu pindai kode QRIS yang muncul.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-100 text-center">
              <div className="w-8 h-8 rounded-full bg-[#10B981] text-white font-extrabold text-sm flex items-center justify-center mx-auto mb-2.5">
                3
              </div>
              <h3 className="font-bold text-sm text-[#0F172A] mb-1">
                File Langsung Terkirim
              </h3>
              <p className="text-xs text-[#64748B]">
                Detik itu juga setelah lunas, link unduhan produk otomatis masuk ke kotak masuk emailmu!
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* REKOMENDASI 3B: TANYA JAWAB (FAQ) & CANVAS KLAIM GARANSI / PESAN */}
        {/* ================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Tanya Jawab (FAQ) */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-[#10B981]" />
              <h2 className="text-lg font-extrabold text-[#0F172A]">
                Tanya Jawab (FAQ)
              </h2>
            </div>

            <div className="space-y-2.5">
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
                      className="w-full p-4 text-left flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-[#0F172A]"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${
                          isOpen ? 'rotate-180 text-[#10B981]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-[#64748B] leading-relaxed border-t border-slate-100 pt-3 bg-white">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Canvas Formulir Klaim Garansi & Request Layanan Khusus */}
          <div
            ref={canvasFormRef}
            className="lg:col-span-6 bg-white border border-emerald-200 rounded-2xl p-6 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquarePlus className="w-5 h-5 text-[#10B981]" />
              <h2 className="text-lg font-extrabold text-[#0F172A]">
                Canvas Klaim Garansi & Pesan Khusus
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mb-5">
              Produk belum masuk ke email atau ingin memesan pembuatan Web/Excel kustom? Tulis pesanmu di bawah ini — langsung terkirim ke Admin kami!
            </p>

            <form onSubmit={handleSendCanvasMessage} className="space-y-3.5">
              {/* Pilihan Tujuan Pesan */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMsgType('KLAIM_GARANSI')}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${
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
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${
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
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${
                    msgType === 'PERTANYAAN'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#F8FAFC] text-[#64748B] border-slate-200'
                  }`}
                >
                  💬 Tanya Admin
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Nama Kamu *
                  </label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Contoh: Budi"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Email Kamu *
                  </label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    No. WhatsApp (Agar Cepat Dibalas)
                  </label>
                  <input
                    type="text"
                    value={senderContact}
                    onChange={(e) => setSenderContact(e.target.value)}
                    placeholder="Contoh: 0812xxxx"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Nomor Invoice (Jika Klaim Produk)
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Contoh: INV-2026xxxx"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Tulis Pesan / Detail Klaim / Permintaan Kustom *
                </label>
                <textarea
                  rows={4}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    msgType === 'KLAIM_GARANSI'
                      ? 'Tuliskan kendalamu (misal: Saya sudah bayar QRIS untuk produk X tapi email belum masuk)...'
                      : 'Jelaskan website sederhana atau template Excel seperti apa yang ingin kamu pesan...'
                  }
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {msgFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
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
                className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isSendingMsg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim ke Admin...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Pesan Sekarang</span>
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

      {/* Modal Detail Produk (Tinggi 2/3 Layar, Gambar Ikut Ter-scroll, Mendukung Tombol Back HP) */}
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

      {/* Slide-Over Keranjang Belanja (Mendukung Tombol Back HP) */}
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