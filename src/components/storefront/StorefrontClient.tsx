'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
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
  Clock,
  Copy,
  KeyRound,
  MessageCircle,
  Info,
} from 'lucide-react';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
  CustomServiceConfig,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
  SubscriptionOrder,
} from '@/lib/supabase';
import { Category, Product, CartItem, StoreSettings } from '@/types';

interface StorefrontClientProps {
  initialProducts: Product[];
  categories: Category[];
  settings: StoreSettings;
}

const CART_STORAGE_KEY = 'rizzflow_cart_v1';
const PRODUCTS_PER_SLIDE = 6;
const VISIBLE_CATEGORY_LIMIT = 5;

const OLD_DEFAULT_DESC =
  'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.';
const NEW_GENERAL_DESC =
  'Solusi Produk Digital Instan, Akun Premium Bergaransi, dan Layanan Pembuatan Kustom Sesuai Kebutuhanmu.';

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara kerja pembelian Produk Tipe Langganan (Netflix, CapCut Pro, dll.)?',
    a: 'Untuk produk bertanda "Langganan", kamu tidak perlu membayar di awal! Cukup klik produknya, ambil Kode Antrian 4 Angka (gratis), atau hubungi Admin via WhatsApp/Telegram. Begitu Admin mengonfirmasi stok tersedia (maksimal 2 jam), kamu akan menerima email dan bisa langsung membayar via QRIS menggunakan Kode 4 Angka tersebut.',
  },
  {
    q: 'Bagaimana cara menerima file untuk Produk Instan (E-Book, Template Excel, PPT)?',
    a: 'Untuk produk bertanda "Instan", kamu bisa langsung checkout dan bayar via QRIS. Detik itu juga setelah pembayaran terdeteksi lunas, link unduhan otomatis dikirim ke kotak masuk emailmu.',
  },
  {
    q: 'Bagaimana jika email produk belum masuk ke kotak masuk utama?',
    a: 'Periksa tab Promosi/Spam di Gmail kamu, atau gunakan kolom "Cek Kode Antrian 4 Angka" (untuk produk langganan) maupun "Canvas Klaim Garansi" di bagian bawah website ini.',
  },
  {
    q: 'Bagaimana cara memesan Layanan Kustom (Pembuatan Web / Template Excel)?',
    a: 'Klik tombol "Pesan Layanan Kustom" di bawah katalog, lalu tuliskan detail kebutuhanmu pada Canvas Pesan. Admin kami akan segera menghubungi kamu.',
  },
];

export default function StorefrontClient({
  initialProducts,
  categories: initialCategories,
  settings: initialSettings,
}: StorefrontClientProps) {
  const router = useRouter();
  const canvasFormRef = useRef(null as HTMLDivElement | null);
  const catalogTopRef = useRef(null as HTMLDivElement | null);
  const subCheckRef = useRef(null as HTMLDivElement | null);

  // State data utama
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [customService, setCustomService] = useState<CustomServiceConfig>(
    DEFAULT_CUSTOM_SERVICE_CONFIG
  );

  // State filter katalog, pencarian, kategori, & slide
  const [catalogTypeFilter, setCatalogTypeFilter] = useState(
    'ALL' as 'ALL' | 'INSTAN' | 'LANGGANAN'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(1);

  // State detail produk, keranjang, dan FAQ
  const [activeProduct, setActiveProduct] = useState(null as Product | null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedProductId, setAddedProductId] = useState(null as string | null);
  const [openFaqIndex, setOpenFaqIndex] = useState(0 as number | null);

  // State khusus produk langganan (Pre-Order Kode 4 Angka & Cek Status)
  const [subPreorderProduct, setSubPreorderProduct] = useState(
    null as Product | null
  );
  const [subName, setSubName] = useState<string>('');
  const [subEmail, setSubEmail] = useState<string>('');
  const [subContact, setSubContact] = useState<string>('');
  const [isCreatingSub, setIsCreatingSub] = useState<boolean>(false);
  const [subModalError, setSubModalError] = useState(null as string | null);
  const [createdSubOrder, setCreatedSubOrder] = useState(
    null as SubscriptionOrder | null
  );
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showSubGuideModal, setShowSubGuideModal] = useState<boolean>(false);

  // State kolom pengecekan kode 4 angka
  const [checkCodeInput, setCheckCodeInput] = useState<string>('');
  const [checkedSubOrder, setCheckedSubOrder] = useState(
    null as SubscriptionOrder | null
  );
  const [isCheckingCode, setIsCheckingCode] = useState<boolean>(false);
  const [checkCodeError, setCheckCodeError] = useState(null as string | null);
  const [isSubSimMode, setIsSubSimMode] = useState<boolean>(false);
  const [isProcessingSubPayment, setIsProcessingSubPayment] =
    useState<boolean>(false);

  // State Canvas Formulir Klaim Garansi & Pesan Layanan Khusus
  const [msgType, setMsgType] = useState(
    'KLAIM_GARANSI' as 'KLAIM_GARANSI' | 'LAYANAN_KHUSUS' | 'PERTANYAAN'
  );
  const [senderName, setSenderName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [senderContact, setSenderContact] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isSendingMsg, setIsSendingMsg] = useState<boolean>(false);
  const [msgFeedback, setMsgFeedback] = useState(
    null as { type: 'success' | 'error'; text: string } | null
  );

  const bannerDescription =
    !settings.banner_description ||
    settings.banner_description === OLD_DEFAULT_DESC
      ? NEW_GENERAL_DESC
      : settings.banner_description;

  useEffect(() => {
    const refreshStorefrontData = async () => {
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

    refreshStorefrontData();
  }, []);

  useEffect(() => {
    setCurrentSlide(1);
  }, [searchQuery, selectedCategoryId, catalogTypeFilter]);

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
    const handleHardwareBackButton = () => {
      setActiveProduct(null);
      setIsCartOpen(false);
      setSubPreorderProduct(null);
      setShowSubGuideModal(false);
    };

    window.addEventListener('popstate', handleHardwareBackButton);
    return () =>
      window.removeEventListener('popstate', handleHardwareBackButton);
  }, []);

  const closeOverlayCleanly = () => {
    setActiveProduct(null);
    setIsCartOpen(false);
    setSubPreorderProduct(null);
    setShowSubGuideModal(false);
    if (window.history.state?.rizzflowOverlay) {
      window.history.back();
    }
  };

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

  const handleAddToCart = (product: Product) => {
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

    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id
    );
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
      setCheckCodeInput(data.subscription.code);
      setCheckedSubOrder(data.subscription);
    } catch (err) {
      setSubModalError(
        err instanceof Error ? err.message : 'Gagal membuat kode antrian.'
      );
    } finally {
      setIsCreatingSub(false);
    }
  };

  const handleCheckSubscriptionCode = async (
    e?: React.FormEvent,
    codeOverride?: string
  ) => {
    if (e) e.preventDefault();
    const targetCode = (codeOverride ?? checkCodeInput).trim();
    if (!targetCode) return;

    setIsCheckingCode(true);
    setCheckCodeError(null);
    try {
      const res = await fetch(
        `/api/subscriptions?code=${encodeURIComponent(targetCode)}`
      );
      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        setCheckedSubOrder(null);
        throw new Error(data.error || 'Kode 4 angka tidak ditemukan.');
      }

      setCheckedSubOrder(data.subscription);
      setIsSubSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setCheckCodeError(
        err instanceof Error ? err.message : 'Gagal mengecek kode antrian.'
      );
    } finally {
      setIsCheckingCode(false);
    }
  };

  const handleGenerateSubscriptionQris = async (code: string) => {
    setIsProcessingSubPayment(true);
    setCheckCodeError(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_QRIS',
          code,
        }),
      });

      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        simulation_mode?: boolean;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        throw new Error(data.error || 'Gagal menyiapkan QRIS.');
      }

      setCheckedSubOrder(data.subscription);
      setIsSubSimMode(Boolean(data.simulation_mode));
    } catch (err) {
      setCheckCodeError(
        err instanceof Error ? err.message : 'Gagal membuat QRIS.'
      );
    } finally {
      setIsProcessingSubPayment(false);
    }
  };

  const handleConfirmSubscriptionPayment = async (code: string) => {
    setIsProcessingSubPayment(true);
    setCheckCodeError(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_PAYMENT',
          code,
        }),
      });

      const data = (await res.json()) as {
        subscription?: SubscriptionOrder;
        error?: string;
      };

      if (!res.ok || !data.subscription) {
        throw new Error(data.error || 'Gagal mengonfirmasi pembayaran.');
      }

      setCheckedSubOrder(data.subscription);
    } catch (err) {
      setCheckCodeError(
        err instanceof Error ? err.message : 'Gagal memproses pembayaran.'
      );
    } finally {
      setIsProcessingSubPayment(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getDirectWhatsAppUrl = (customText: string) => {
    const rawWa = customService.admin_whatsapp || settings.support_contact || '';
    const digits = rawWa.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const formatted = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
    return `[https://wa.me/$](https://wa.me/$){formatted}?text=${encodeURIComponent(customText)}`;
  };

  const getDirectTelegramUrl = () => {
    const rawTg = (customService.admin_telegram || '').trim().replace(/^@/, '');
    if (!rawTg) return null;
    return rawTg.startsWith('http') ? rawTg : `[https://t.me/$](https://t.me/$){rawTg}`;
  };

  const handleJumpToCustomServiceCanvas = () => {
    setMsgType('LAYANAN_KHUSUS');
    if (!messageText.trim()) {
      setMessageText(
        'Halo Admin RizzFlow, saya ingin memesan Layanan Kustom. Berikut detail kebutuhan saya: '
      );
    }
    canvasFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const deliverables = parseProductDeliverables(product.file_path);
      const pType = deliverables.product_type || 'INSTAN';

      const matchesType =
        catalogTypeFilter === 'ALL' || pType === catalogTypeFilter;
      const matchesCategory =
        selectedCategoryId === 'ALL' ||
        product.category_id === selectedCategoryId;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.title.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      return matchesType && matchesCategory && matchesSearch;
    });
  }, [products, catalogTypeFilter, selectedCategoryId, searchQuery]);

  const totalSlides = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_SLIDE)
  );
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentSlide - 1) * PRODUCTS_PER_SLIDE;
    return filteredProducts.slice(startIdx, startIdx + PRODUCTS_PER_SLIDE);
  }, [filteredProducts, currentSlide]);

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

  const activeProductDeliverables = useMemo(() => {
    if (!activeProduct) return null;
    return parseProductDeliverables(activeProduct.file_path);
  }, [activeProduct]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] flex flex-col overflow-x-hidden">
      {/* Bilah Navigasi Atas */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.jpg"
              alt={settings.store_name}
              className="h-9 w-auto rounded-lg object-contain shadow-sm shrink-0"
            />
            <span className="font-bold text-base sm:text-lg tracking-tight text-[#0F172A] truncate">
              {settings.store_name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                subCheckRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#059669] bg-[#ECFDF5] hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5"/>
              <span>Cek Kode 4 Angka</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200/80 transition-colors"
              aria-label="Buka Keranjang Belanja"
            >
              <ShoppingBag className="w-4 h-4 text-[#10B981]"/>
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

      {/* Konten Utama Katalog Toko */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-8 space-y-6">
        {/* Banner Sambutan + 4 Keunggulan Ringkas */}
        <section className="space-y-3">
          <div className="bg-gradient-to-br from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-100 rounded-2xl p-5 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight mb-1.5">
              Semua Kebutuhan Produk Digitalmu di Satu Tempat
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl leading-relaxed break-words">
              {bannerDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <Zap className="w-3.5 h-3.5 text-[#10B981] shrink-0"/>
              <span>File Instan &amp; Akun Premium</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <QrCode className="w-3.5 h-3.5 text-[#10B981] shrink-0"/>
              <span>QRIS Resmi</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <UserCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0"/>
              <span>Tanpa Daftar Akun</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-xs font-bold text-[#0F172A]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0"/>
              <span>Bergaransi 100%</span>
            </div>
          </div>
        </section>

        {/* WIDGET CEK KODE ANTRIAN / PRE-ORDER LANGGANAN (4 ANGKA) */}
        <section
          ref={subCheckRef}
          className="bg-white border-2 border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#059669]">
                <KeyRound className="w-4 h-4"/>
                <span>Lacak Pesanan Akun Premium / Langganan</span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] mt-0.5">
                Cek Status Kode Pre-Order / Antrian (4 Angka)
              </h2>
              <p className="text-xs text-[#64748B]">
                Masukkan 4 angka kode antrianmu untuk melihat konfirmasi stok Admin, membayar QRIS, atau mengambil akunmu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSubGuideModal(true)}
              className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#059669] border border-emerald-200 text-xs font-bold shrink-0"
            >
              <Info className="w-3.5 h-3.5"/>
              <span>Cara Beli Produk Langganan</span>
            </button>
          </div>

          <form
            onSubmit={(e) => handleCheckSubscriptionCode(e)}
            className="flex gap-2"
          >
            <input
              type="text"
              maxLength={4}
              value={checkCodeInput}
              onChange={(e) =>
                setCheckCodeInput(e.target.value.replace(/[^0-9]/g, ''))
              }
              placeholder="Ketik 4 angka kode antrian (Contoh: 4829)"
              className="flex-1 px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-extrabold tracking-widest text-[#0F172A] placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-[#10B981]"
            />
            <button
              type="submit"
              disabled={isCheckingCode || checkCodeInput.length < 4}
              className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm transition-colors shrink-0"
            >
              {isCheckingCode ? 'Mengecek...' : 'Cek Status'}
            </button>
          </form>

          {checkCodeError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-[#EF4444] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{checkCodeError}</span>
            </div>
          )}

          {checkedSubOrder && (
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#64748B]">
                    Kode Antrian:{' '}
                    <strong className="text-[#0F172A] text-sm">
                      #{checkedSubOrder.code}
                    </strong>
                  </span>
                  <h3 className="font-extrabold text-base text-[#0F172A]">
                    {checkedSubOrder.product_title} — Rp
                    {checkedSubOrder.product_price.toLocaleString('id-ID')}
                  </h3>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold self-start sm:self-center ${
                    checkedSubOrder.status === 'MENUNGGU_ADMIN'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : checkedSubOrder.status === 'STOK_TERSEDIA'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : checkedSubOrder.status === 'DIPROSES'
                      ? 'bg-[#ECFDF5] text-[#059669] border border-emerald-300'
                      : 'bg-red-100 text-[#EF4444] border border-red-300'
                  }`}
                >
                  {checkedSubOrder.status === 'MENUNGGU_ADMIN'
                    ? '1. Menunggu Jawaban Admin (Maks 2 Jam)'
                    : checkedSubOrder.status === 'STOK_TERSEDIA'
                    ? 'Stok Tersedia — Silakan Bayar QRIS'
                    : checkedSubOrder.status === 'DIPROSES'
                    ? '2. Pesanan Diproses (Tidak Bisa Dibatalkan)'
                    : '3. Pesanan Dibatalkan'}
                </span>
              </div>

              <div className="text-xs text-[#0F172A] space-y-1">
                <p>
                  <strong>Keterangan:</strong> {checkedSubOrder.admin_note}
                </p>
                {checkedSubOrder.status === 'MENUNGGU_ADMIN' && (
                  <p className="text-amber-700 font-semibold">
                    Batas waktu respon Admin sampai:{' '}
                    {new Date(checkedSubOrder.expires_wait_at).toLocaleTimeString(
                      'id-ID',
                      { hour: '2-digit', minute: '2-digit' }
                    )}{' '}
                    WIB (Jika lewat 2 jam belum dijawab, pesanan otomatis dibatalkan).
                  </p>
                )}
              </div>

              {checkedSubOrder.status === 'STOK_TERSEDIA' && (
                <div className="pt-2 space-y-3">
                  {!checkedSubOrder.qris_string ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateSubscriptionQris(checkedSubOrder.code)
                      }
                      disabled={isProcessingSubPayment}
                      className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm"
                    >
                      <QrCode className="w-4 h-4"/>
                      <span>
                        {isProcessingSubPayment
                          ? 'Menyiapkan Kode QRIS...'
                          : 'Stok Tersedia! Klik untuk Bayar Sekarang via QRIS'}
                      </span>
                    </button>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center space-y-3">
                      <p className="text-xs font-bold text-[#0F172A]">
                        Pindai QRIS di bawah ini untuk menyelesaikan pembayaran:
                      </p>
                      <div className="bg-[#F8FAFC] p-3 rounded-xl inline-block border border-slate-200">
                        {React.createElement(QRCodeSVG, {
                          value: checkedSubOrder.qris_string,
                          size: 180,
                        })}
                      </div>
                      {isSubSimMode && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmSubscriptionPayment(
                                checkedSubOrder.code
                              )
                            }
                            disabled={isProcessingSubPayment}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs"
                          >
                            {isProcessingSubPayment
                              ? 'Memproses...'
                              : '✨ Simulasikan Pembayaran QRIS Lunas'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {checkedSubOrder.status === 'DIPROSES' &&
                checkedSubOrder.delivered_account && (
                  <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-emerald-300 space-y-1.5">
                    <div className="text-xs font-extrabold text-[#059669]">
                      🎉 Detail Akun / Produk Langganan Kamu:
                    </div>
                    <pre className="text-xs font-mono text-[#0F172A] whitespace-pre-wrap break-all bg-white p-3 rounded-lg border border-emerald-200">
                      {checkedSubOrder.delivered_account}
                    </pre>
                  </div>
                )}
            </div>
          )}
        </section>

        {/* Pencarian, Filter Tipe Produk, & Katalog */}
        <section ref={catalogTopRef} className="space-y-4">
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('ALL')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
                  catalogTypeFilter === 'ALL'
                    ? 'bg-white text-[#0F172A] shadow-sm border border-slate-200/60'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Semua Katalog
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('INSTAN')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
                  catalogTypeFilter === 'INSTAN'
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                ⚡ Produk File Instan
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('LANGGANAN')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
                  catalogTypeFilter === 'LANGGANAN'
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                👑 Katalog Langganan
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari e-book, template, CapCut Pro, Netflix..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-4 h-4"/>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCategoryId === 'ALL'
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-slate-200/80'
                }`}
              >
                Semua Kategori
              </button>

              {displayedCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#10B981] text-white shadow-sm'
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

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 px-4">
              <FileText className="w-9 h-9 text-[#64748B] mx-auto mb-2 stroke-[1.5]"/>
              <p className="font-semibold text-sm text-[#0F172A] mb-0.5">
                Produk tidak ditemukan
              </p>
              <p className="text-xs text-[#64748B]">
                Coba pilih tab Semua Katalog atau gunakan kata kunci lain.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`slide-${currentSlide}-${selectedCategoryId}-${catalogTypeFilter}-${searchQuery}`}
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
                    const deliverables = parseProductDeliverables(
                      product.file_path
                    );
                    const isSubscription =
                      deliverables.product_type === 'LANGGANAN';
                    const origPrice = deliverables.original_price;
                    const hasDiscount =
                      typeof origPrice === 'number' &&
                      origPrice > product.price;
                    const savePercent = hasDiscount
                      ? Math.round(
                          ((origPrice - product.price) / origPrice) * 100
                        )
                      : 0;

                    return (
                      <div
                        key={product.id}
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
                            <span
                              className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                                isSubscription
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[#ECFDF5] text-[#059669] border border-emerald-200'
                              }`}
                            >
                              {isSubscription
                                ? '👑 Langganan'
                                : product.badge || '⚡ Instan'}
                            </span>

                            {hasDiscount && savePercent > 0 && (
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white">
                                -{savePercent}%
                              </span>
                            )}
                            {thumbList.length > 1 && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/70 text-white inline-flex items-center gap-1">
                                <Images className="w-3 h-3"/>
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
                              isSubscription
                                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                : isAdded
                                ? 'bg-[#059669] text-white'
                                : 'bg-[#10B981] hover:bg-[#059669] text-white'
                            }`}
                          >
                            {isSubscription ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-emerald-400"/>
                                <span>Cek Stok &amp; Ambil Kode</span>
                              </>
                            ) : isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5"/>
                                <span>Ditambahkan</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5"/>
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

              {totalSlides > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1 bg-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    disabled={currentSlide === 1}
                    onClick={() => {
                      setCurrentSlide((p) => Math.max(1, p - 1));
                      catalogTopRef.current?.scrollIntoView({
                        behavior: 'smooth',
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#0F172A] disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4"/>
                    <span>Sebelumnya</span>
                  </button>

                  <span className="text-xs font-extrabold text-[#0F172A]">
                    Slide {currentSlide} / {totalSlides}
                  </span>

                  <button
                    type="button"
                    disabled={currentSlide === totalSlides}
                    onClick={() => {
                      setCurrentSlide((p) => Math.min(totalSlides, p + 1));
                      catalogTopRef.current?.scrollIntoView({
                        behavior: 'smooth',
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#0F172A] disabled:opacity-40"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* LAYANAN KUSTOM RINGKAS */}
        <section className="bg-gradient-to-r from-[#ECFDF5] via-[#F8FAFC] to-white border border-emerald-200/80 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#059669]">
                <Sparkles className="w-4 h-4 shrink-0"/>
                <span>Layanan Kustom RizzFlow</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] break-words">
                {customService.title}
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed break-words">
                {customService.description}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {customService.services.map((srv, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-[#0F172A]"
                  >
                    <Check className="w-3 h-3 text-[#10B981] shrink-0"/>
                    <span>{srv}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={handleJumpToCustomServiceCanvas}
                className="w-full md:w-auto px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Pesan Layanan Kustom</span>
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </section>

        {/* CARA BELANJA KREATIF & BERANIMASI */}
        <section className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 overflow-hidden relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="sm:max-w-[200px] shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                ⚡ Otomatis &amp; Bergaransi
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                3 Langkah Mudah Belanja di RizzFlow
              </h2>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 relative">
              <div className="hidden sm:block absolute top-5 left-12 right-12 h-0.5 bg-slate-700 overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.8,
                    ease: 'linear',
                  }}
                  className="w-1/2 h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                />
              </div>

              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5"
                >
                  <MousePointerClick className="w-4 h-4"/>
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  1. Pilih Produk
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  Instan / Ambil Kode
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 0.6 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5"
                >
                  <QrCode className="w-4 h-4"/>
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  2. Scan QRIS
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  Tanpa perlu daftar akun
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 1.2 }}
                  className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center mb-1.5"
                >
                  <MailCheck className="w-4 h-4"/>
                </motion.div>
                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                  3. Produk Diterima!
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline mt-0.5">
                  Via Email &amp; Cek Kode
                </span>
              </motion.div>
            </div>
          </div>
        </section>

        {/* TANYA JAWAB (FAQ) & CANVAS KLAIM GARANSI */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3.5">
              <HelpCircle className="w-4 h-4 text-[#10B981]"/>
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
                      <span
                        className={
                          isOpen
                            ? 'rotate-180 text-[#10B981] transition-transform shrink-0'
                            : 'text-[#64748B] transition-transform shrink-0'
                        }
                      >
                        <ChevronDown className="w-4 h-4"/>
                      </span>
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

          <div
            ref={canvasFormRef}
            className="lg:col-span-7 bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquarePlus className="w-4 h-4 text-[#10B981]"/>
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Canvas Klaim Garansi &amp; Pesan Layanan Kustom
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
                  placeholder="No. Invoice / Kode 4 Angka"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <textarea
                rows={3}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Tuliskan detail klaim atau pesanan layanan kustom kamu..."
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
                    <CheckCircle2 className="w-4 h-4 shrink-0"/>
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0"/>
                  )}
                  <span>{msgFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingMsg}
                className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {isSendingMsg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4"/>
                    <span>Kirim Pesan ke Admin</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

     {/* MODAL AMBIL KODE PRE-ORDER 4 ANGKA (KHUSUS PRODUK TIPE LANGGANAN) */}
      <AnimatePresence>
        {subPreorderProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                  👑 Produk Tipe Langganan
                </span>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!createdSubOrder ? (
                <div className="space-y-4">
                  {/* Info Produk yang Dipilih */}
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <h3 className="font-extrabold text-base text-[#0F172A]">
                      {subPreorderProduct.title}
                    </h3>
                    <p className="text-sm font-extrabold text-[#10B981] mt-0.5">
                      Rp{subPreorderProduct.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* OPSI 1: HUBUNGI ADMIN LANGSUNG VIA WA / TELEGRAM */}
                  <div className="p-4 rounded-xl bg-[#ECFDF5]/60 border border-emerald-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-[#059669]">
                      OPSI 1 — Hubungi Admin Langsung (Respon Lebih Cepat)
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      Ingin cek stok dan transaksi langsung melalui chat? Klik tombol WhatsApp atau Telegram Admin di bawah ini:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {getDirectWhatsAppUrl(
                        `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (Rp${subPreorderProduct.price.toLocaleString('id-ID')}). Apakah stoknya tersedia saat ini?`
                      ) ? (
                        <a
                          href={
                            getDirectWhatsAppUrl(
                              `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (Rp${subPreorderProduct.price.toLocaleString('id-ID')}). Apakah stoknya tersedia saat ini?`
                            )!
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat via WhatsApp</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#64748B] italic">
                          (Nomor WA belum diatur di Admin)
                        </span>
                      )}

                      {getDirectTelegramUrl() && (
                        <a
                          href={getDirectTelegramUrl()!}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>Chat via Telegram</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Garis Pemisah Antara Opsi 1 dan Opsi 2 */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200" />
                    <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-[#64748B]">
                      ATAU TRANSAKSI DI WEBSITE
                    </span>
                    <div className="flex-grow border-t border-slate-200" />
                  </div>

                  {/* OPSI 2: AMBIL KODE 4 ANGKA & BALASAN VIA EMAIL */}
                  <form
                    onSubmit={handleCreateSubscriptionPreorder}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-[#0F172A]">
                        OPSI 2 — Ambil Kode 4 Angka (Balasan via Email &amp; Bayar di Web)
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                        Dapatkan Kode Antrian 4 Angka tanpa bayar di awal. Admin akan mengirim konfirmasi stok ke emailmu (maks 2 jam) dan kamu bisa lanjut bayar via QRIS di website ini.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Nama Kamu *"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                      <input
                        type="email"
                        required
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        placeholder="Alamat Email Aktif * (Untuk terima balasan)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                      <input
                        type="text"
                        value={subContact}
                        onChange={(e) => setSubContact(e.target.value)}
                        placeholder="Nomor WhatsApp (Opsional)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    {subModalError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-[#EF4444]">
                        {subModalError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isCreatingSub}
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isCreatingSub ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Membuat Kode 4 Angka...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 text-emerald-400" />
                          <span>Ambil Kode 4 Angka &amp; Lanjut di Web</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-[#ECFDF5] border-2 border-[#10B981]">
                    <span className="text-xs font-bold text-[#059669] uppercase">
                      Kode Pre-Order / Antrian Kamu:
                    </span>
                    <div className="text-4xl font-extrabold tracking-widest text-[#0F172A] my-2">
                      {createdSubOrder.code}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdSubOrder.code)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-bold text-[#059669]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiedCode ? 'Kode Disalin!' : 'Salin Kode 4 Angka'}
                      </span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
                    <p className="font-extrabold">
                      ⚠️ PENTING: Salin atau ingat 4 angka di atas!
                    </p>
                    <p>
                      Kami akan mengirimkan email ke <strong>{createdSubOrder.customer_email}</strong> begitu stok dikonfirmasi Admin. Kamu juga bisa mengecek status dan membayar QRIS kapan saja di kotak <em>Cek Status Kode 4 Angka</em> di halaman depan.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeOverlayCleanly}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F172A]"
                  >
                    Tutup &amp; Lihat Status di Halaman Depan
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>{/* MODAL AMBIL KODE PRE-ORDER 4 ANGKA (KHUSUS PRODUK TIPE LANGGANAN) */}
      <AnimatePresence>
        {subPreorderProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                  👑 Produk Tipe Langganan
                </span>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!createdSubOrder ? (
                <div className="space-y-4">
                  {/* Info Produk yang Dipilih */}
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <h3 className="font-extrabold text-base text-[#0F172A]">
                      {subPreorderProduct.title}
                    </h3>
                    <p className="text-sm font-extrabold text-[#10B981] mt-0.5">
                      Rp{subPreorderProduct.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* OPSI 1: HUBUNGI ADMIN LANGSUNG VIA WA / TELEGRAM */}
                  <div className="p-4 rounded-xl bg-[#ECFDF5]/60 border border-emerald-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-[#059669]">
                      OPSI 1 — Hubungi Admin Langsung (Respon Lebih Cepat)
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      Ingin cek stok dan transaksi langsung melalui chat? Klik tombol WhatsApp atau Telegram Admin di bawah ini:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {getDirectWhatsAppUrl(
                        `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (Rp${subPreorderProduct.price.toLocaleString('id-ID')}). Apakah stoknya tersedia saat ini?`
                      ) ? (
                        <a
                          href={
                            getDirectWhatsAppUrl(
                              `Halo Admin RizzFlow, saya ingin membeli produk langganan *${subPreorderProduct.title}* (Rp${subPreorderProduct.price.toLocaleString('id-ID')}). Apakah stoknya tersedia saat ini?`
                            )!
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat via WhatsApp</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#64748B] italic">
                          (Nomor WA belum diatur di Admin)
                        </span>
                      )}

                      {getDirectTelegramUrl() && (
                        <a
                          href={getDirectTelegramUrl()!}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>Chat via Telegram</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Garis Pemisah Antara Opsi 1 dan Opsi 2 */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200" />
                    <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-[#64748B]">
                      ATAU TRANSAKSI DI WEBSITE
                    </span>
                    <div className="flex-grow border-t border-slate-200" />
                  </div>

                  {/* OPSI 2: AMBIL KODE 4 ANGKA & BALASAN VIA EMAIL */}
                  <form
                    onSubmit={handleCreateSubscriptionPreorder}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-[#0F172A]">
                        OPSI 2 — Ambil Kode 4 Angka (Balasan via Email &amp; Bayar di Web)
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                        Dapatkan Kode Antrian 4 Angka tanpa bayar di awal. Admin akan mengirim konfirmasi stok ke emailmu (maks 2 jam) dan kamu bisa lanjut bayar via QRIS di website ini.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Nama Kamu *"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                      <input
                        type="email"
                        required
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        placeholder="Alamat Email Aktif * (Untuk terima balasan)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                      <input
                        type="text"
                        value={subContact}
                        onChange={(e) => setSubContact(e.target.value)}
                        placeholder="Nomor WhatsApp (Opsional)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    {subModalError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-[#EF4444]">
                        {subModalError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isCreatingSub}
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {isCreatingSub ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Membuat Kode 4 Angka...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 text-emerald-400" />
                          <span>Ambil Kode 4 Angka &amp; Lanjut di Web</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-[#ECFDF5] border-2 border-[#10B981]">
                    <span className="text-xs font-bold text-[#059669] uppercase">
                      Kode Pre-Order / Antrian Kamu:
                    </span>
                    <div className="text-4xl font-extrabold tracking-widest text-[#0F172A] my-2">
                      {createdSubOrder.code}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdSubOrder.code)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-bold text-[#059669]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiedCode ? 'Kode Disalin!' : 'Salin Kode 4 Angka'}
                      </span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
                    <p className="font-extrabold">
                      ⚠️ PENTING: Salin atau ingat 4 angka di atas!
                    </p>
                    <p>
                      Kami akan mengirimkan email ke <strong>{createdSubOrder.customer_email}</strong> begitu stok dikonfirmasi Admin. Kamu juga bisa mengecek status dan membayar QRIS kapan saja di kotak <em>Cek Status Kode 4 Angka</em> di halaman depan.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeOverlayCleanly}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F172A]"
                  >
                    Tutup &amp; Lihat Status di Halaman Depan
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* MODAL PENJELASAN DETAIL CARA BELI PRODUK LANGGANAN */}
      <AnimatePresence>
        {showSubGuideModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-[#0F172A]">
                  Panduan Pembelian Produk Langganan
                </h3>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="p-1 rounded-lg text-[#64748B]"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#0F172A] leading-relaxed">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                  <strong>1. Cek Stok Dulu Tanpa Bayar di Awal</strong>
                  <p className="text-[#64748B] mt-0.5">
                    Pilih produk bertanda 👑 Langganan, masukkan emailmu, dan dapatkan <strong>Kode Antrian 4 Angka</strong>. Wajib salin/ingat 4 angka tersebut.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                  <strong>2. Tiga Status Kode Antrian Kamu</strong>
                  <ul className="list-disc pl-4 mt-1 text-[#64748B] space-y-1">
                    <li>
                      <strong>Menunggu Jawaban Admin:</strong> Admin mengecek stok maksimal 2 jam. Lewat 2 jam tanpa jawaban otomatis dibatalkan.
                    </li>
                    <li>
                      <strong>Stok Tersedia &amp; Pesanan Diproses:</strong> Saat stok tersedia, kamu mendapat notif email dan bisa bayar QRIS di kolom Cek Kode. Setelah bayar, pesanan diproses (tidak dapat dibatalkan) dan akun dikirim ke layar &amp; emailmu.
                    </li>
                    <li>
                      <strong>Pesanan Dibatalkan:</strong> Jika stok sedang habis.
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={closeOverlayCleanly}
                className="w-full py-3 rounded-xl bg-[#10B981] text-white font-bold text-xs"
              >
                Saya Mengerti
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <ShoppingBag className="w-5 h-5"/>
                <span>{totalCartItems} Produk di Keranjang</span>
              </div>
              <div className="flex items-center gap-1 font-bold">
                <span>Rp{totalCartPrice.toLocaleString('id-ID')}</span>
                <ArrowRight className="w-4 h-4"/>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detail Produk (2/3 Layar, Gambar Ikut Ter-scroll) */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOverlayCleanly}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
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
              >
                <X className="w-5 h-5"/>
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
                            prev === 0
                              ? activeProductImages.length - 1
                              : prev - 1
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md"
                      >
                        <ChevronLeft className="w-5 h-5"/>
                      </button>
                      <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-xs font-bold">
                        {activeImageIndex + 1} / {activeProductImages.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveImageIndex((prev) =>
                            prev === activeProductImages.length - 1
                              ? 0
                              : prev + 1
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center shadow-md"
                      >
                        <ChevronRight className="w-5 h-5"/>
                      </button>
                    </>
                  )}
                </div>

                <div className="p-5 sm:p-6 space-y-3.5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      activeProductDeliverables?.product_type === 'LANGGANAN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#ECFDF5] text-[#059669]'
                    }`}
                  >
                    {activeProductDeliverables?.product_type === 'LANGGANAN'
                      ? '👑 Produk Langganan (Cek Stok 4 Angka)'
                      : activeProduct.badge || '⚡ Pengiriman File Instan'}
                  </span>

                  <h3 className="text-xl font-extrabold text-[#0F172A] break-words">
                    {activeProduct.title}
                  </h3>

                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-extrabold text-[#10B981]">
                      Rp{activeProduct.price.toLocaleString('id-ID')}
                    </span>
                    {activeProductDeliverables?.original_price &&
                      activeProductDeliverables.original_price >
                        activeProduct.price && (
                        <span className="text-sm text-[#64748B] line-through">
                          Rp
                          {activeProductDeliverables.original_price.toLocaleString(
                            'id-ID'
                          )}
                        </span>
                      )}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                      Deskripsi Produk
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
                    const prod = activeProduct;
                    handleAddToCart(prod);
                    if (
                      parseProductDeliverables(prod.file_path).product_type !==
                      'LANGGANAN'
                    ) {
                      setActiveProduct(null);
                      setIsCartOpen(true);
                    }
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm transition-colors shadow-sm"
                >
                  {activeProductDeliverables?.product_type === 'LANGGANAN'
                    ? 'Cek Stok & Ambil Kode Antrian (4 Angka)'
                    : 'Tambah ke Keranjang & Lihat'}
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
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end overscroll-contain"
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
                  <ShoppingBag className="w-5 h-5 text-[#10B981]"/>
                  <h3 className="font-bold text-lg text-[#0F172A]">
                    Keranjang Belanja
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeOverlayCleanly}
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]"/>
                    <p className="font-semibold text-[#0F172A] mb-1">
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
                                onClick={() =>
                                  handleUpdateQuantity(item.product.id, -1)
                                }
                                className="text-[#64748B]"
                              >
                                <Minus className="w-3.5 h-3.5"/>
                              </button>
                              <span className="text-xs font-bold w-5 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQuantity(item.product.id, 1)
                                }
                                className="text-[#64748B]"
                              >
                                <Plus className="w-3.5 h-3.5"/>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.product.id,
                                  -item.quantity
                                )
                              }
                              className="text-[#64748B] hover:text-[#EF4444] p-1"
                            >
                              <Trash2 className="w-4 h-4"/>
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
                    <span className="text-sm text-[#64748B]">
                      Subtotal Pesanan
                    </span>
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
                    className="w-full py-3.5 px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <span>Lanjut ke Checkout</span>
                    <ArrowRight className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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