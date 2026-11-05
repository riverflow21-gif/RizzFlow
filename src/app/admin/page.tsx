'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
  CustomerSupportMessage,
  CustomServiceConfig,
  CustomProjectOrder,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
} from '@/lib/supabase';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  TicketPercent,
  Settings,
  LogOut,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Upload,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Inbox,
  Check,
  Menu,
  X,
  Sparkles,
  BellRing,
  Smartphone,
  Search,
  KeyRound,
} from 'lucide-react';
import {
  Category,
  Product,
  PromoCode,
  Order,
  StoreSettings,
} from '@/types';

// 5 Halaman Utama Admin yang Kompleks & Rapi
type AdminTab =
  | 'dashboard'
  | 'catalog'
  | 'services'
  | 'promos'
  | 'settings';

type CatalogActionPanel = 'NONE' | 'ADD_PRODUCT' | 'MANAGE_CATEGORIES';
type ServicesSubTab = 'CUSTOM_ORDERS' | 'INBOX_MESSAGES';

interface FeedbackBanner {
  type: 'success' | 'error';
  message: string;
}

interface PendingCounts {
  paidOrders: number;
  unreadMsgs: number;
  customQueues: number;
}

interface PwaInstallEvent extends Event {
  prompt: () => Promise<void>;
}

type NullableFeedback = FeedbackBanner | null;
type NullablePwaEvent = PwaInstallEvent | null;
type NullablePendingCounts = PendingCounts | null;
type NullableProduct = Product | null;
type NullableString = string | null;

const LOGO_PATH = '/logo.jpg?v=2';

/**
 * Membunyikan nada dering alarm di HP/Laptop Admin saat ada pesanan, proyek kustom, atau klaim baru.
 */
function playAdminNotificationBeep() {
  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Abaikan jika browser memblokir suara otomatis
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard' as AdminTab);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [feedback, setFeedback] = useState(null as NullableFeedback);

  // State Aplikasi Mobile Admin (PWA) & Notifikasi HP
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(
    null as NullablePwaEvent
  );
  const [notifPermission, setNotifPermission] = useState('default');
  const prevCountsRef = useRef(null as NullablePendingCounts);

  // State Data Utama
  const [products, setProducts] = useState([] as Product[]);
  const [categories, setCategories] = useState([] as Category[]);
  const [promos, setPromos] = useState([] as PromoCode[]);
  const [orders, setOrders] = useState([] as Order[]);
  const [supportMessages, setSupportMessages] = useState(
    [] as CustomerSupportMessage[]
  );
  const [customOrders, setCustomOrders] = useState(
    [] as CustomProjectOrder[]
  );
  const [settings, setSettings] = useState({
    id: 1,
    store_name: 'RizzFlow',
    banner_description: '',
    support_contact: '',
    updated_at: '',
  } as StoreSettings);
  const [customService, setCustomService] = useState(
    DEFAULT_CUSTOM_SERVICE_CONFIG as CustomServiceConfig
  );

  // State Halaman 1 (Dashboard & Riwayat Penjualan)
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [resendingOrderId, setResendingOrderId] = useState(
    null as NullableString
  );

  // State Halaman 2 (Produk & Kategori dalam 1 Halaman dengan Tombol Terpisah)
  const [catalogPanel, setCatalogPanel] = useState(
    'NONE' as CatalogActionPanel
  );
  const [editingProduct, setEditingProduct] = useState(
    null as NullableProduct
  );
  const [adminProductSearch, setAdminProductSearch] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('ALL');
  const [prodTitle, setProdTitle] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState('');
  const [prodBadge, setProdBadge] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [thumbnailFiles, setThumbnailFiles] = useState([] as File[]);
  const [digitalFiles, setDigitalFiles] = useState([] as File[]);
  const [productLinks, setProductLinks] = useState([''] as string[]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [catName, setCatName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // State Halaman 3 (Pesan & Antrian Layanan Kustom)
  const [servicesSubTab, setServicesSubTab] = useState(
    'CUSTOM_ORDERS' as ServicesSubTab
  );
  const [customPriceDraft, setCustomPriceDraft] = useState(
    {} as { [key: string]: string }
  );
  const [customNoteDraft, setCustomNoteDraft] = useState(
    {} as { [key: string]: string }
  );
  const [customLinkDraft, setCustomLinkDraft] = useState(
    {} as { [key: string]: string }
  );
  const [customFilesDraft, setCustomFilesDraft] = useState(
    {} as { [key: string]: File[] }
  );
  const [updatingCustomId, setUpdatingCustomId] = useState(
    null as NullableString
  );

  // State Halaman 4 (Kode Promo)
  const [promoCode, setPromoCode] = useState('');
  const [promoPercent, setPromoPercent] = useState('20');
  const [promoMaxRp, setPromoMaxRp] = useState('15000');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoExpiresAt, setPromoExpiresAt] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  // State Halaman 5 (Pengaturan Toko, Layanan Kustom, & Bot Telegram)
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingCustomService, setIsSavingCustomService] = useState(false);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/admin/login');
  }, [router]);

  // Registrasi PWA Service Worker & Listener Install Aplikasi di HP
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Abaikan jika gagal register
        });
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e as PwaInstallEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
  }, []);

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showMessage('error', 'Browser perangkatmu belum mendukung notifikasi.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotifPermission(permission);

    if (permission === 'granted') {
      playAdminNotificationBeep();
      new Notification('Alarm Admin RizzFlow Aktif!', {
        body: 'Perangkatmu akan berbunyi saat ada pembelian, pesanan kustom, atau klaim baru.',
        icon: LOGO_PATH,
      });
      showMessage('success', 'Alarm & Notifikasi HP berhasil diaktifkan!');
    } else {
      showMessage(
        'error',
        'Izin notifikasi ditolak. Aktifkan izin notifikasi di pengaturan browser.'
      );
    }
  };

  const handleInstallPwaApp = async () => {
    if (deferredPwaPrompt) {
      await deferredPwaPrompt.prompt();
      setDeferredPwaPrompt(null);
    } else {
      showMessage(
        'success',
        'Untuk memasang aplikasi di HP: Klik menu titik tiga di pojok kanan atas browser Chrome/Safari, lalu pilih "Tambahkan ke Layar Utama" (Add to Home Screen).'
      );
    }
  };

  // Auto-Logout setelah 30 menit tanpa aktivitas
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, 30 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
    };
  }, [handleLogout]);

  const fetchAllAdminData = useCallback(
    async (tokenOverride?: string, isBackgroundPoll = false) => {
      const tokenToUse = tokenOverride || accessToken;
      const [prodRes, catRes, promoRes, orderRes, setRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('promo_codes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false }),
        supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (catRes.data) {
        const catList = catRes.data as Category[];
        setCategories(catList);
        if (catList.length > 0 && !prodCategoryId) {
          setProdCategoryId(catList[0].id);
        }
      }
      if (promoRes.data) setPromos(promoRes.data as PromoCode[]);

      let currentPaidCount = 0;
      if (orderRes.data) {
        const ordList = orderRes.data as Order[];
        setOrders(ordList);
        currentPaidCount = ordList.filter(
          (o) => o.payment_status === 'PAID'
        ).length;
      }

      if (setRes.data) setSettings(setRes.data as StoreSettings);

      if (tokenToUse) {
        try {
          const msgRes = await fetch('/api/messages', {
            headers: { Authorization: `Bearer ${tokenToUse}` },
          });

          let currentUnreadMsgs = 0;
          let currentCustomQueues = 0;

          if (msgRes.ok) {
            const msgData = (await msgRes.json()) as {
              messages?: CustomerSupportMessage[];
              customServiceConfig?: CustomServiceConfig;
              customOrders?: CustomProjectOrder[];
            };
            if (msgData.messages) {
              setSupportMessages(msgData.messages);
              currentUnreadMsgs = msgData.messages.filter(
                (m) => m.status === 'BARU'
              ).length;
            }
            if (msgData.customOrders) {
              setCustomOrders(msgData.customOrders);
              currentCustomQueues = msgData.customOrders.filter(
                (o) => o.status === 'MENUNGGU_PENGERJAAN'
              ).length;
            }
            if (msgData.customServiceConfig && !isBackgroundPoll) {
              setCustomService(msgData.customServiceConfig);
            }
          }

          if (prevCountsRef.current) {
            const prev = prevCountsRef.current;
            if (
              currentPaidCount > prev.paidOrders ||
              currentUnreadMsgs > prev.unreadMsgs ||
              currentCustomQueues > prev.customQueues
            ) {
              playAdminNotificationBeep();
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification('Aktivitas Baru di Toko RizzFlow!', {
                  body:
                    currentPaidCount > prev.paidOrders
                      ? 'Ada pembayaran pesanan baru yang telah lunas!'
                      : currentCustomQueues > prev.customQueues
                      ? 'Ada pesanan Layanan Kustom baru yang masuk ke antrian!'
                      : 'Ada pesan pelanggan / klaim garansi baru!',
                  icon: LOGO_PATH,
                });
              }
            }
          }

          prevCountsRef.current = {
            paidOrders: currentPaidCount,
            unreadMsgs: currentUnreadMsgs,
            customQueues: currentCustomQueues,
          };
        } catch (e) {
          console.error('Gagal memuat pesan & layanan kustom:', e);
        }
      }
    },
    [prodCategoryId, accessToken]
  );

  useEffect(() => {
    const verifyAdmin = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/admin/login');
        return;
      }
      const token = data.session.access_token;
      setAccessToken(token);
      setAdminEmail(data.session.user.email || 'Admin');

      const now = new Date();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setPromoStartsAt(now.toISOString().slice(0, 16));
      setPromoExpiresAt(nextWeek.toISOString().slice(0, 16));

      await fetchAllAdminData(token);
      setIsLoadingInitial(false);
    };

    verifyAdmin();
  }, [router, fetchAllAdminData]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      fetchAllAdminData(accessToken, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [accessToken, fetchAllAdminData]);

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==========================================================================
  // 1. LOGIKA PRODUK & KATEGORI (DALAM 1 HALAMAN DENGAN TOMBOL TERPISAH)
  // ==========================================================================
  const handleAddLinkRow = () => setProductLinks((prev) => [...prev, '']);
  const handleUpdateLinkRow = (index: number, value: string) =>
    setProductLinks((prev) =>
      prev.map((item, idx) => (idx === index ? value : item))
    );
  const handleRemoveLinkRow = (index: number) =>
    setProductLinks((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== index) : ['']
    );

  const handleStartEditProduct = (product: Product) => {
    const deliverables = parseProductDeliverables(product.file_path);
    setEditingProduct(product);
    setCatalogPanel('ADD_PRODUCT');
    setProdTitle(product.title);
    setProdCategoryId(product.category_id || '');
    setProdPrice(String(product.price));
    setProdOriginalPrice(
      deliverables.original_price ? String(deliverables.original_price) : ''
    );
    setProdBadge(product.badge || '');
    setProdDesc(product.description);
    setProductLinks(
      deliverables.links && deliverables.links.length > 0
        ? deliverables.links
        : ['']
    );
    setThumbnailFiles([]);
    setDigitalFiles([]);
    setFileInputKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditProduct = () => {
    setEditingProduct(null);
    setCatalogPanel('NONE');
    setProdTitle('');
    setProdPrice('');
    setProdOriginalPrice('');
    setProdBadge('');
    setProdDesc('');
    setThumbnailFiles([]);
    setDigitalFiles([]);
    setProductLinks(['']);
    setFileInputKey((prev) => prev + 1);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = productLinks
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const existingDeliverables = editingProduct
      ? parseProductDeliverables(editingProduct.file_path)
      : null;

    if (!editingProduct && thumbnailFiles.length === 0) {
      showMessage('error', 'Harap pilih minimal 1 Gambar Sampul (Thumbnail).');
      return;
    }

    const hasExistingFiles =
      existingDeliverables && existingDeliverables.files.length > 0;

    if (
      digitalFiles.length === 0 &&
      !hasExistingFiles &&
      validLinks.length === 0
    ) {
      showMessage(
        'error',
        'Harap unggah minimal 1 File Produk ATAU masukkan minimal 1 Link Produk.'
      );
      return;
    }

    setIsSavingProduct(true);
    try {
      const timestamp = Date.now();
      let thumbnailPayload = editingProduct ? editingProduct.thumbnail_url : '';
      let uploadedFilePaths: string[] = existingDeliverables
        ? existingDeliverables.files
        : [];

      if (thumbnailFiles.length > 0) {
        const uploadedThumbUrls: string[] = [];
        for (let i = 0; i < thumbnailFiles.length; i++) {
          const file = thumbnailFiles[i];
          const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const thumbPath = `thumb_${timestamp}_${i}_${cleanName}`;

          const { error: thumbErr } = await supabase.storage
            .from('product-thumbnails')
            .upload(thumbPath, file, { upsert: false });

          if (thumbErr) {
            throw new Error(`Gagal upload gambar: ${thumbErr.message}`);
          }

          const { data: publicUrlData } = supabase.storage
            .from('product-thumbnails')
            .getPublicUrl(thumbPath);

          uploadedThumbUrls.push(publicUrlData.publicUrl);
        }

        thumbnailPayload =
          uploadedThumbUrls.length === 1
            ? uploadedThumbUrls[0]
            : JSON.stringify(uploadedThumbUrls);
      }

      if (digitalFiles.length > 0) {
        const newFilePaths: string[] = [];
        for (let j = 0; j < digitalFiles.length; j++) {
          const dFile = digitalFiles[j];
          const cleanName = dFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const digitalPath = `file_${timestamp}_${j}_${cleanName}`;

          const { error: fileErr } = await supabase.storage
            .from('digital-products')
            .upload(digitalPath, dFile, { upsert: false });

          if (fileErr) {
            throw new Error(`Gagal upload file: ${fileErr.message}`);
          }
          newFilePaths.push(digitalPath);
        }
        uploadedFilePaths = newFilePaths;
      }

      const numericOriginalPrice = prodOriginalPrice
        ? Math.max(0, Number(prodOriginalPrice) || 0)
        : null;

      const deliverablesPayload = JSON.stringify({
        files: uploadedFilePaths,
        links: validLinks,
        original_price: numericOriginalPrice,
      });

      if (editingProduct) {
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            title: prodTitle.trim(),
            category_id: prodCategoryId || null,
            price: Math.max(0, Number(prodPrice) || 0),
            badge: prodBadge.trim() ? prodBadge.trim() : null,
            description: prodDesc.trim(),
            thumbnail_url: thumbnailPayload,
            file_path: deliverablesPayload,
          })
          .eq('id', editingProduct.id);

        if (updateErr) throw new Error(updateErr.message);
        showMessage('success', 'Perubahan produk berhasil disimpan!');
      } else {
        const { error: insertErr } = await supabase.from('products').insert({
          title: prodTitle.trim(),
          category_id: prodCategoryId || null,
          price: Math.max(0, Number(prodPrice) || 0),
          badge: prodBadge.trim() ? prodBadge.trim() : null,
          description: prodDesc.trim(),
          thumbnail_url: thumbnailPayload,
          file_path: deliverablesPayload,
          is_active: true,
        });

        if (insertErr) throw new Error(insertErr.message);
        showMessage('success', 'Produk baru berhasil diterbitkan!');
      }

      handleCancelEditProduct();
      await fetchAllAdminData();
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan produk.'
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleToggleProductActive = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Status tampilan produk diperbarui.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Produk berhasil dihapus dari katalog.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setIsSavingCategory(true);
    try {
      const slug = catName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const { error } = await supabase
        .from('categories')
        .insert({ name: catName.trim(), slug });
      if (error) throw new Error(error.message);
      setCatName('');
      await fetchAllAdminData();
      showMessage('success', 'Kategori baru berhasil ditambahkan!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal membuat kategori.'
      );
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Kategori berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 2. LOGIKA ANTRIAN TRANSAKSI LAYANAN KUSTOM (UPLOAD FILE & KIRIM TAGIHAN)
  // ==========================================================================
  const handleCompleteCustomOrderAndSendBill = async (
    customOrd: CustomProjectOrder
  ) => {
    const rawPrice =
      customPriceDraft[customOrd.id] !== undefined
        ? customPriceDraft[customOrd.id]
        : String(customOrd.price || '');
    const numericPrice = Math.max(0, Number(rawPrice) || 0);

    if (numericPrice < 1000) {
      showMessage(
        'error',
        'Harap isi Harga Tagihan minimal Rp1.000 sebelum menandai pesanan selesai.'
      );
      return;
    }

    const selectedFiles = customFilesDraft[customOrd.id] || [];
    const externalLink = (
      customLinkDraft[customOrd.id] !== undefined
        ? customLinkDraft[customOrd.id]
        : customOrd.delivery_links[0] || ''
    ).trim();

    if (
      selectedFiles.length === 0 &&
      customOrd.file_paths.length === 0 &&
      !externalLink
    ) {
      showMessage(
        'error',
        'Harap unggah minimal 1 File Produk Kustom ATAU isi Link Hasil Pengerjaan terlebih dahulu.'
      );
      return;
    }

    setUpdatingCustomId(customOrd.id);
    try {
      const timestamp = Date.now();
      let finalFilePaths = [...customOrd.file_paths];

      if (selectedFiles.length > 0) {
        const uploadedPaths: string[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const f = selectedFiles[i];
          const cleanName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `custom_${customOrd.order_code}_${timestamp}_${i}_${cleanName}`;

          const { error: upErr } = await supabase.storage
            .from('digital-products')
            .upload(storagePath, f, { upsert: false });

          if (upErr) {
            throw new Error(`Gagal mengunggah file kustom: ${upErr.message}`);
          }
          uploadedPaths.push(storagePath);
        }
        finalFilePaths = uploadedPaths;
      }

      const finalLinks = externalLink ? [externalLink] : [];
      const finalNote =
        customNoteDraft[customOrd.id] !== undefined
          ? customNoteDraft[customOrd.id]
          : 'Produk kustom kamu telah selesai dikerjakan! Silakan selesaikan pembayaran tagihan via QRIS untuk mengunduh file produkmu.';

      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target_type: 'CUSTOM_ORDER',
          id: customOrd.id,
          status: 'SIAP_DIBAYAR',
          price: numericPrice,
          admin_note: finalNote,
          file_paths: finalFilePaths,
          delivery_links: finalLinks,
        }),
      });

      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan produk kustom.');
      }

      if (data.customOrders) setCustomOrders(data.customOrders);
      showMessage(
        'success',
        data.message ||
          `Pesanan ${customOrd.order_code} selesai & email tagihan telah dikirim ke pelanggan!`
      );
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal memproses pesanan kustom.'
      );
    } finally {
      setUpdatingCustomId(null);
    }
  };

  const handleDeleteCustomOrder = async (id: string) => {
    const res = await fetch(`/api/messages?id=${id}&type=CUSTOM_ORDER`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
      };
      if (data.customOrders) setCustomOrders(data.customOrders);
      showMessage('success', 'Data pesanan kustom dihapus.');
    }
  };

  const handleToggleMessageStatus = async (msg: CustomerSupportMessage) => {
    const nextStatus = msg.status === 'BARU' ? 'SELESAI' : 'BARU';
    const res = await fetch('/api/messages', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        target_type: 'MESSAGE',
        id: msg.id,
        status: nextStatus,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: CustomerSupportMessage[];
      };
      if (data.messages) setSupportMessages(data.messages);
    }
  };

  const handleDeleteSupportMessage = async (id: string) => {
    const res = await fetch(`/api/messages?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: CustomerSupportMessage[];
      };
      if (data.messages) setSupportMessages(data.messages);
      showMessage('success', 'Pesan dihapus.');
    }
  };

  // ==========================================================================
  // 3. LOGIKA KODE PROMO, RIWAYAT ORDER, & PENGATURAN (+ BOT TELEGRAM)
  // ==========================================================================
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPromo(true);
    try {
      const cleanCode = promoCode.trim().toUpperCase().replace(/\s+/g, '');
      const percent = Math.min(100, Math.max(1, Number(promoPercent) || 1));
      const maxRp = Math.max(0, Number(promoMaxRp) || 0);

      const { error } = await supabase.from('promo_codes').insert({
        code: cleanCode,
        discount_percent: percent,
        max_discount_amount: maxRp,
        starts_at: new Date(promoStartsAt).toISOString(),
        expires_at: new Date(promoExpiresAt).toISOString(),
        is_active: true,
      });

      if (error) throw new Error(error.message);
      setPromoCode('');
      await fetchAllAdminData();
      showMessage('success', `Kode promo ${cleanCode} berhasil dibuat!`);
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal membuat kode promo.'
      );
    } finally {
      setIsSavingPromo(false);
    }
  };

  const handleTogglePromo = async (promo: PromoCode) => {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !promo.is_active })
      .eq('id', promo.id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Status kode promo diperbarui.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Kode promo dihapus.');
    }
  };

  const handleResendDownloadEmail = async (orderId: string) => {
    setResendingOrderId(orderId);
    try {
      const res = await fetch('/api/admin/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ulang email.');
      showMessage('success', data.message || 'Email berhasil dikirim ulang!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal kirim email.'
      );
    } finally {
      setResendingOrderId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .update({
          store_name: settings.store_name.trim(),
          banner_description: settings.banner_description.trim(),
          support_contact: settings.support_contact.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (error) throw new Error(error.message);
      showMessage('success', 'Pengaturan identitas toko berhasil disimpan!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddServiceItem = () => {
    setCustomService((prev) => ({
      ...prev,
      services: [...prev.services, ''],
    }));
  };

  const handleUpdateServiceItem = (index: number, value: string) => {
    setCustomService((prev) => ({
      ...prev,
      services: prev.services.map((s, idx) => (idx === index ? value : s)),
    }));
  };

  const handleRemoveServiceItem = (index: number) => {
    setCustomService((prev) => ({
      ...prev,
      services:
        prev.services.length > 1
          ? prev.services.filter((_, idx) => idx !== index)
          : [''],
    }));
  };

  const handleSaveCustomServiceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomService(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(customService),
      });

      const data = (await res.json()) as {
        customServiceConfig?: CustomServiceConfig;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan.');
      }
      if (data.customServiceConfig) setCustomService(data.customServiceConfig);
      showMessage(
        'success',
        data.message ||
          'Pengaturan Layanan Kustom & Notifikasi Telegram disimpan!'
      );
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setIsSavingCustomService(false);
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="min-h-screen bg-[#F6F8F3] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-[#0F2A1D]">
          <Loader2 className="w-5 h-5 animate-spin text-[#375534]" />
          <span>Memuat Panel Admin {settings.store_name}...</span>
        </div>
      </div>
    );
  }

  // Kalkulasi Analitik Dashboard
  const paidOrdersList = orders.filter((o) => o.payment_status === 'PAID');
  const pendingOrdersList = orders.filter(
    (o) => o.payment_status === 'PENDING'
  );
  const totalPaidRevenue = paidOrdersList.reduce(
    (acc, o) => acc + o.final_amount,
    0
  );

  const todayIsoPrefix = new Date().toISOString().slice(0, 10);
  const todayRevenue = paidOrdersList
    .filter((o) => (o.paid_at || o.created_at).startsWith(todayIsoPrefix))
    .reduce((acc, o) => acc + o.final_amount, 0);

  const unreadMessagesCount = supportMessages.filter(
    (m) => m.status === 'BARU'
  ).length;
  const activeCustomQueuesCount = customOrders.filter(
    (o) => o.status === 'MENUNGGU_PENGERJAAN'
  ).length;
  const totalServiceAlerts = unreadMessagesCount + activeCustomQueuesCount;

  const navBtnClass = (tab: AdminTab) =>
    activeTab === tab
      ? 'flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all bg-[#E3EED4] text-[#0F2A1D] shadow-xs'
      : 'flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all text-[#AEC3B0] hover:bg-[#375534]/50 hover:text-white';

  const renderSidebarNavItems = () => (
    <nav className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => selectTab('dashboard')}
        className={navBtnClass('dashboard')}
      >
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard &amp; Penjualan</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => selectTab('catalog')}
        className={navBtnClass('catalog')}
      >
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4 shrink-0" />
          <span>Produk &amp; Kategori</span>
        </div>
        <span className="text-[11px] opacity-80">{products.length}</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('services')}
        className={navBtnClass('services')}
      >
        <div className="flex items-center gap-3">
          <Inbox className="w-4 h-4 shrink-0" />
          <span>Pesan &amp; Layanan Kustom</span>
        </div>
        {totalServiceAlerts > 0 && (
          <span
            className={
              activeTab === 'services'
                ? 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#0F2A1D] text-[#E3EED4]'
                : 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#E3EED4] text-[#0F2A1D]'
            }
          >
            {totalServiceAlerts}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => selectTab('promos')}
        className={navBtnClass('promos')}
      >
        <div className="flex items-center gap-3">
          <TicketPercent className="w-4 h-4 shrink-0" />
          <span>Kode Promo</span>
        </div>
        <span className="text-[11px] opacity-80">{promos.length}</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('settings')}
        className={navBtnClass('settings')}
      >
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 shrink-0" />
          <span>Pengaturan &amp; Telegram</span>
        </div>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F6F8F3] text-[#0F2A1D] flex flex-col md:flex-row overflow-x-hidden">
      {/* HEADER ATAS KHUSUS HP */}
      <header className="md:hidden sticky top-0 z-30 bg-[#0F2A1D] text-[#E3EED4] px-4 h-15 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#375534]/80 text-[#E3EED4] border border-[#6B9071]/40 relative"
            aria-label="Buka Menu Admin"
          >
            <Menu className="w-5 h-5" />
            {totalServiceAlerts > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#E3EED4] absolute -top-0.5 -right-0.5" />
            )}
          </button>
          <img
            src={LOGO_PATH}
            alt="Logo"
            className="h-8 w-8 rounded-lg object-contain bg-white p-0.5 shrink-0"
          />
          <span className="font-extrabold text-sm text-white truncate">
            Admin {settings.store_name}
          </span>
        </div>

        <Link
          href="/"
          className="px-3 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1"
        >
          <span>Toko</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* SIDE NAVBAR DRAWER DI SAMPING KIRI (UNTUK LAYAR HP) */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-[#0F2A1D]/70 backdrop-blur-xs md:hidden flex"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-68 bg-[#0F2A1D] text-[#E3EED4] h-full shadow-2xl flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#375534]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={LOGO_PATH}
                    alt="Logo"
                    className="h-9 w-9 rounded-xl object-contain bg-white p-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-white truncate">
                      {settings.store_name}
                    </div>
                    <div className="text-[11px] text-[#AEC3B0] truncate">
                      {adminEmail}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-[#AEC3B0] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderSidebarNavItems()}
            </div>

            <div className="pt-4 border-t border-[#375534] space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-red-200 bg-red-950/70 border border-red-400/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVBAR TETAP DI SAMPING KIRI (UNTUK DESKTOP/LAPTOP) */}
      <aside className="hidden md:flex md:w-68 bg-[#0F2A1D] text-[#E3EED4] shrink-0 flex-col justify-between min-h-screen sticky top-0 shadow-xl">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-7 pb-4 border-b border-[#375534]">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={LOGO_PATH}
                alt={settings.store_name}
                className="h-10 w-10 rounded-xl object-contain bg-white p-0.5 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-extrabold text-base text-white truncate">
                  {settings.store_name}
                </div>
                <div className="text-[11px] text-[#AEC3B0] truncate">
                  {adminEmail}
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="p-2 rounded-xl bg-[#375534] hover:bg-[#6B9071] text-[#E3EED4] transition-colors"
              title="Lihat Halaman Toko"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {renderSidebarNavItems()}
        </div>

        <div className="p-5 border-t border-[#375534]">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-red-200 bg-red-950/60 hover:bg-red-900/80 border border-red-400/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* AREA KONTEN UTAMA 5 HALAMAN ADMIN */}
      {/* ==================================================================== */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-5xl w-full mx-auto overflow-x-hidden">
        {feedback && (
          <div
            className={
              feedback.type === 'success'
                ? 'mb-6 p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 break-words bg-[#E3EED4] border-[#6B9071] text-[#0F2A1D]'
                : 'mb-6 p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 break-words bg-red-50 border-red-200 text-red-700'
            }
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#375534]" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.message}</span>
          </div>
        )}

        {/* ================================================================== */}
        {/* HALAMAN 1: DASHBOARD ANALITIK, PENDAPATAN & RIWAYAT PENJUALAN */}
        {/* ================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header Dashboard & Kontrol Cepat Aplikasi Mobile Admin */}
            <div className="rounded-[28px] bg-[#0F2A1D] text-[#E3EED4] p-6 sm:p-7 border border-[#375534] shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#AEC3B0]">
                  Ringkasan Eksekutif Toko
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Dashboard Pendapatan &amp; Penjualan
                </h1>
                <p className="text-xs text-[#AEC3B0]">
                  Pantau arus kas masuk, pesanan produk instan, dan antrian proyek kustom secara real-time.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleEnableBrowserNotifications}
                  className={
                    notifPermission === 'granted'
                      ? 'px-3.5 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 bg-[#375534] text-[#E3EED4] border border-[#6B9071]'
                      : 'px-3.5 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 bg-[#E3EED4] text-[#0F2A1D]'
                  }
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>
                    {notifPermission === 'granted'
                      ? 'Alarm Pesanan Aktif'
                      : 'Aktifkan Alarm HP'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleInstallPwaApp}
                  className="px-3.5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-[#AEC3B0]/40 text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Pasang Aplikasi Admin</span>
                </button>
              </div>
            </div>

            {/* 6 Kartu Statistik Kompleks */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
                <span className="text-xs font-bold text-[#6B9071]">
                  Total Pendapatan Lunas
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5 truncate">
                  Rp{totalPaidRevenue.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] font-bold text-[#375534] mt-1 block">
                  ✓ {paidOrdersList.length} transaksi selesai
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
                <span className="text-xs font-bold text-[#6B9071]">
                  Pendapatan Hari Ini
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#375534] mt-1.5 truncate">
                  Rp{todayRevenue.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-[#6B9071] mt-1 block">
                  Update otomatis harian
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
                <span className="text-xs font-bold text-[#6B9071]">
                  Menunggu Pembayaran QRIS
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
                  {pendingOrdersList.length} Pesanan
                </div>
                <span className="text-[11px] text-[#6B9071] mt-1 block">
                  Belum dipindai pembeli
                </span>
              </div>

              <div
                onClick={() => selectTab('catalog')}
                className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow cursor-pointer hover:border-[#375534] transition-colors"
              >
                <span className="text-xs font-bold text-[#6B9071]">
                  Total Produk &amp; Kategori
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
                  {products.length} Produk
                </div>
                <span className="text-[11px] font-bold text-[#375534] mt-1 block">
                  Dalam {categories.length} kategori →
                </span>
              </div>

              <div
                onClick={() => {
                  setServicesSubTab('CUSTOM_ORDERS');
                  selectTab('services');
                }}
                className="bg-[#E3EED4]/75 p-5 rounded-3xl border border-[#6B9071]/60 rf-card-shadow cursor-pointer hover:bg-[#E3EED4] transition-colors"
              >
                <span className="text-xs font-extrabold text-[#375534]">
                  Antrian Layanan Kustom
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
                  {activeCustomQueuesCount} Proyek
                </div>
                <span className="text-[11px] font-bold text-[#375534] mt-1 block">
                  Klik untuk unggah hasil &amp; tagihan →
                </span>
              </div>

              <div
                onClick={() => {
                  setServicesSubTab('INBOX_MESSAGES');
                  selectTab('services');
                }}
                className="bg-white p-5 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow cursor-pointer hover:border-[#375534] transition-colors"
              >
                <span className="text-xs font-bold text-[#6B9071]">
                  Klaim Garansi &amp; Pesan
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D] mt-1.5">
                  {unreadMessagesCount} Baru
                </div>
                <span className="text-[11px] font-bold text-[#375534] mt-1 block">
                  Total {supportMessages.length} pesan masuk →
                </span>
              </div>
            </div>

            {/* Tabel Riwayat Penjualan & Pengiriman Ulang Email */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                    Riwayat Transaksi &amp; Penjualan ({orders.length})
                  </h2>
                  <p className="text-xs text-[#6B9071]">
                    Seluruh pesanan produk instan maupun pelunasan layanan kustom tercatat di sini.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-[#6B9071] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Cari No. Invoice atau Email..."
                    className="w-full pl-9 pr-8 py-2 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                  />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B9071]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {orders.length === 0 ? (
                <p className="text-sm text-[#6B9071] text-center py-10">
                  Belum ada riwayat transaksi.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {orders
                    .filter((ord) => {
                      const q = orderSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        ord.invoice_number.toLowerCase().includes(q) ||
                        ord.customer_email.toLowerCase().includes(q)
                      );
                    })
                    .map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D]">
                              #{ord.invoice_number}
                            </span>
                            <span
                              className={
                                ord.payment_status === 'PAID'
                                  ? 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071]'
                                  : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800'
                              }
                            >
                              {ord.payment_status}
                            </span>
                            <span className="text-[11px] text-[#6B9071]">
                              {new Date(ord.created_at).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#0F2A1D] break-all">
                            Pembeli:{' '}
                            <span className="text-[#375534]">
                              {ord.customer_email}
                            </span>
                          </p>
                          <div className="text-sm font-extrabold text-[#0F2A1D]">
                            Nominal: Rp
                            {ord.final_amount.toLocaleString('id-ID')}
                          </div>
                        </div>

                        {ord.payment_status === 'PAID' &&
                          !ord.invoice_number.startsWith('INV-KST-') && (
                            <button
                              type="button"
                              onClick={() => handleResendDownloadEmail(ord.id)}
                              disabled={resendingOrderId === ord.id}
                              className="px-4 py-2 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                            >
                              <Send className="w-3.5 h-3.5 text-[#E3EED4]" />
                              <span>
                                {resendingOrderId === ord.id
                                  ? 'Mengirim...'
                                  : 'Kirim Ulang Email'}
                              </span>
                            </button>
                          )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* HALAMAN 2: PRODUK & KATEGORI (1 HALAMAN DENGAN TOMBOL TERPISAH) */}
        {/* ================================================================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            {/* Baris Atas: Judul & 2 Tombol Aksi Terpisah (+ Tambah Produk | + Kelola Kategori) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D]">
                  Manajemen Produk &amp; Kategori
                </h1>
                <p className="text-xs text-[#6B9071] mt-0.5">
                  Kelola seluruh katalog produk digital dan kategori dalam satu halaman terpadu.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (catalogPanel === 'ADD_PRODUCT' && !editingProduct) {
                      setCatalogPanel('NONE');
                    } else {
                      handleCancelEditProduct();
                      setCatalogPanel('ADD_PRODUCT');
                    }
                  }}
                  className={
                    catalogPanel === 'ADD_PRODUCT'
                      ? 'px-4 py-2.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm'
                      : 'px-4 py-2.5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors'
                  }
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingProduct ? 'Mode Edit Produk' : 'Tambah Produk Baru'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCatalogPanel((prev) =>
                      prev === 'MANAGE_CATEGORIES'
                        ? 'NONE'
                        : 'MANAGE_CATEGORIES'
                    )
                  }
                  className={
                    catalogPanel === 'MANAGE_CATEGORIES'
                      ? 'px-4 py-2.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm'
                      : 'px-4 py-2.5 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors'
                  }
                >
                  <FolderTree className="w-4 h-4" />
                  <span>Tambah / Kelola Kategori ({categories.length})</span>
                </button>
              </div>
            </div>

            {/* PANEL 1: FORM TAMBAH / EDIT PRODUK (Muncul Saat Tombol Produk Diklik) */}
            {catalogPanel === 'ADD_PRODUCT' && (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-[#375534] rf-card-shadow">
                <div className="flex items-center justify-between gap-2 mb-5 pb-3 border-b border-[#AEC3B0]/40">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                      {editingProduct
                        ? `Edit Produk: ${editingProduct.title}`
                        : 'Formulir Tambah Produk Digital Baru'}
                    </h2>
                    <p className="text-xs text-[#6B9071]">
                      {editingProduct
                        ? 'Kosongkan input gambar/file jika tidak ingin mengganti gambar/file lama.'
                        : 'Isi rincian produk, unggah gambar sampul, lalu lampirkan file atau link Google Drive.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelEditProduct}
                    className="p-2 rounded-full bg-[#F6F8F3] hover:bg-red-50 text-[#0F2A1D] hover:text-red-600"
                    title="Tutup Formulir"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                        Nama Produk Digital *
                      </label>
                      <input
                        type="text"
                        required
                        value={prodTitle}
                        onChange={(e) => setProdTitle(e.target.value)}
                        placeholder="Contoh: Paket E-Book & Template Excel"
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                        Kategori Produk *
                      </label>
                      <select
                        value={prodCategoryId}
                        onChange={(e) => setProdCategoryId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                      >
                        <option value="">-- Tanpa Kategori --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                        Harga Jual Saat Ini (Rp) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="Contoh: 35000"
                        className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#375534] mb-1">
                        Harga Asli / Harga Coret (Opsional — Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={prodOriginalPrice}
                        onChange={(e) => setProdOriginalPrice(e.target.value)}
                        placeholder="Contoh: 99000"
                        className="w-full px-3.5 py-2.5 bg-[#E3EED4]/45 border border-[#6B9071]/50 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                      Label Badge (Opsional)
                    </label>
                    <input
                      type="text"
                      value={prodBadge}
                      onChange={(e) => setProdBadge(e.target.value)}
                      placeholder="Contoh: Terlaris / Baru"
                      className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                      Deskripsi Lengkap Produk *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      placeholder="Jelaskan detail produk, keunggulan, dan apa saja yang didapat pembeli..."
                      className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-dashed border-[#6B9071] min-w-0">
                      <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                        1. Pilih Gambar Sampul / Thumbnail (Bisa lebih dari 1){' '}
                        {editingProduct ? '(Opsional saat Edit)' : '*'}
                      </label>
                      <input
                        key={`thumb-${fileInputKey}`}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          setThumbnailFiles(
                            e.target.files ? Array.from(e.target.files) : []
                          )
                        }
                        className="text-xs text-[#0F2A1D] w-full mt-1"
                      />
                      {thumbnailFiles.length > 0 && (
                        <p className="text-[11px] font-bold text-[#375534] mt-2 break-all">
                          ✓ {thumbnailFiles.length} gambar dipilih
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-[#E3EED4]/55 border border-dashed border-[#375534] min-w-0">
                      <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                        2A. Upload File Produk (Opsional — Bisa lebih dari 1 file)
                      </label>
                      <input
                        key={`digital-${fileInputKey}`}
                        type="file"
                        multiple
                        onChange={(e) =>
                          setDigitalFiles(
                            e.target.files ? Array.from(e.target.files) : []
                          )
                        }
                        className="text-xs text-[#0F2A1D] w-full mt-1"
                      />
                      {digitalFiles.length > 0 && (
                        <p className="text-[11px] font-bold text-[#375534] mt-2 break-all">
                          ✓ {digitalFiles.length} file dipilih
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold text-[#0F2A1D]">
                        2B. Link Produk Eksternal / Google Drive (Opsional)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddLinkRow}
                        className="px-3 py-1.5 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0] text-[#0F2A1D] text-xs font-bold inline-flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Baris Link</span>
                      </button>
                    </div>

                    {productLinks.map((linkVal, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <LinkIcon className="w-4 h-4 text-[#6B9071] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            value={linkVal}
                            onChange={(e) =>
                              handleUpdateLinkRow(idx, e.target.value)
                            }
                            placeholder="https://drive.google.com/..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-[#AEC3B0]/60 rounded-xl text-xs sm:text-sm"
                          />
                        </div>
                        {productLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkRow(idx)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="px-6 py-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] disabled:bg-[#AEC3B0] text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors"
                    >
                      {isSavingProduct ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#E3EED4]" />
                          <span>
                            {editingProduct
                              ? 'Simpan Perubahan Produk'
                              : 'Simpan & Terbitkan Produk'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelEditProduct}
                      className="px-5 py-3 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0] text-[#0F2A1D] font-bold text-xs sm:text-sm"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* PANEL 2: FORM TAMBAH & KELOLA KATEGORI (Muncul Saat Tombol Kategori Diklik) */}
            {catalogPanel === 'MANAGE_CATEGORIES' && (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-[#6B9071] rf-card-shadow space-y-5">
                <div className="flex items-center justify-between border-b border-[#AEC3B0]/40 pb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                      Tambah &amp; Kelola Kategori Produk
                    </h2>
                    <p className="text-xs text-[#6B9071]">
                      Buat kategori baru atau hapus kategori yang sudah tidak digunakan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatalogPanel('NONE')}
                    className="p-2 rounded-full bg-[#F6F8F3] text-[#0F2A1D]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateCategory} className="flex gap-2.5">
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ketik nama kategori baru (Contoh: Template Excel / E-Book)..."
                    className="flex-1 min-w-0 px-4 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Simpan Kategori</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="inline-flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full bg-[#E3EED4] border border-[#6B9071]/50 text-xs font-extrabold text-[#0F2A1D]"
                    >
                      <span>{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="w-6 h-6 rounded-full bg-white hover:bg-red-50 text-red-600 flex items-center justify-center"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daftar Katalog Produk Dilengkapi Pencarian & Filter Kategori */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-[#0F2A1D]">
                  Daftar Katalog Produk ({products.length})
                </h3>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <select
                    value={adminCategoryFilter}
                    onChange={(e) => setAdminCategoryFilter(e.target.value)}
                    className="px-3.5 py-2 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs font-bold text-[#0F2A1D]"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#6B9071] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={adminProductSearch}
                      onChange={(e) => setAdminProductSearch(e.target.value)}
                      placeholder="Cari produk untuk diedit..."
                      className="w-full pl-9 pr-8 py-2 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                    />
                    {adminProductSearch && (
                      <button
                        type="button"
                        onClick={() => setAdminProductSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B9071]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {products.length === 0 ? (
                <p className="text-sm text-[#6B9071] py-8 text-center">
                  Belum ada produk di katalog. Klik tombol &ldquo;Tambah Produk Baru&rdquo; di atas untuk memulai.
                </p>
              ) : (
                <div className="space-y-3">
                  {products
                    .filter((p) => {
                      const matchesCat =
                        adminCategoryFilter === 'ALL' ||
                        p.category_id === adminCategoryFilter;
                      const q = adminProductSearch.trim().toLowerCase();
                      const matchesSearch =
                        !q ||
                        p.title.toLowerCase().includes(q) ||
                        p.description.toLowerCase().includes(q);
                      return matchesCat && matchesSearch;
                    })
                    .map((prod) => {
                      const thumbs = parseThumbnails(prod.thumbnail_url);
                      const deliverables = parseProductDeliverables(
                        prod.file_path
                      );

                      return (
                        <div
                          key={prod.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 min-w-0"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={thumbs[0] || LOGO_PATH}
                              alt={prod.title}
                              className="w-14 h-14 rounded-xl object-cover bg-[#E3EED4] border border-[#AEC3B0]/50 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm text-[#0F2A1D] break-words">
                                  {prod.title}
                                </h4>
                                {!prod.is_active && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                    Disembunyikan
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-extrabold text-[#375534]">
                                  Rp{prod.price.toLocaleString('id-ID')}
                                </span>
                                {deliverables.original_price &&
                                  deliverables.original_price > prod.price && (
                                    <span className="text-[11px] text-[#6B9071] line-through">
                                      Rp
                                      {deliverables.original_price.toLocaleString(
                                        'id-ID'
                                      )}
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditProduct(prod)}
                              className="px-3.5 py-1.5 rounded-full border border-[#6B9071]/50 bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white text-xs font-extrabold transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleProductActive(prod)}
                              className="px-3.5 py-1.5 rounded-full border border-[#AEC3B0] bg-white hover:bg-[#F6F8F3] text-xs font-bold inline-flex items-center gap-1.5"
                            >
                              {prod.is_active ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-[#6B9071]" />
                                  <span>Sembunyikan</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-[#375534]" />
                                  <span>Tampilkan</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* HALAMAN 3: PESAN & ANTRIAN TRANSAKSI LAYANAN KUSTOM (KST-XXXX) */}
        {/* ================================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Switch Sub-Halaman: Antrian Proyek Kustom vs Kotak Masuk Klaim */}
            <div className="grid grid-cols-2 gap-2.5 bg-white p-2 rounded-full border border-[#AEC3B0]/60 rf-card-shadow">
              <button
                type="button"
                onClick={() => setServicesSubTab('CUSTOM_ORDERS')}
                className={
                  servicesSubTab === 'CUSTOM_ORDERS'
                    ? 'py-2.5 px-4 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs sm:text-sm font-extrabold transition-all'
                    : 'py-2.5 px-4 rounded-full text-[#375534] hover:text-[#0F2A1D] text-xs sm:text-sm font-bold transition-all'
                }
              >
                ✨ Antrian Layanan Kustom ({customOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setServicesSubTab('INBOX_MESSAGES')}
                className={
                  servicesSubTab === 'INBOX_MESSAGES'
                    ? 'py-2.5 px-4 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs sm:text-sm font-extrabold transition-all'
                    : 'py-2.5 px-4 rounded-full text-[#375534] hover:text-[#0F2A1D] text-xs sm:text-sm font-bold transition-all'
                }
              >
                🛡️ Klaim Garansi &amp; Pesan ({supportMessages.length})
              </button>
            </div>

            {servicesSubTab === 'CUSTOM_ORDERS' ? (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                    Antrian Pemesanan &amp; Pengiriman Produk Layanan Kustom
                  </h2>
                  <p className="text-xs text-[#6B9071] mt-0.5">
                    Saat produk kustom selesai kamu kerjakan, unggah filenya di kolom pemesan di bawah, tentukan harga tagihan, lalu klik <strong>Tandai Selesai &amp; Kirim Tagihan via Email</strong>. Pelanggan akan mengakses tagihan dengan kode <code>KST-XXXX</code> miliknya, dan produk otomatis terkirim begitu ia membayar!
                  </p>
                </div>

                {customOrders.length === 0 ? (
                  <p className="text-sm text-[#6B9071] text-center py-12">
                    Belum ada antrian pesanan layanan kustom.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {customOrders.map((cOrd) => {
                      const isBusy = updatingCustomId === cOrd.id;
                      const priceVal =
                        customPriceDraft[cOrd.id] !== undefined
                          ? customPriceDraft[cOrd.id]
                          : cOrd.price > 0
                          ? String(cOrd.price)
                          : '';
                      const noteVal =
                        customNoteDraft[cOrd.id] !== undefined
                          ? customNoteDraft[cOrd.id]
                          : cOrd.admin_note;
                      const linkVal =
                        customLinkDraft[cOrd.id] !== undefined
                          ? customLinkDraft[cOrd.id]
                          : cOrd.delivery_links[0] || '';
                      const pickedFiles = customFilesDraft[cOrd.id] || [];

                      const cleanWa = cOrd.customer_contact.replace(
                        /[^0-9]/g,
                        ''
                      );
                      const waUrl = cleanWa
                        ? `https://wa.me/${
                            cleanWa.startsWith('0')
                              ? '62' + cleanWa.slice(1)
                              : cleanWa
                          }`
                        : null;

                      return (
                        <div
                          key={cOrd.id}
                          className="p-5 rounded-3xl bg-[#F6F8F3] border-2 border-[#AEC3B0]/70 space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#AEC3B0]/50 pb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold tracking-wider inline-flex items-center gap-1">
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>{cOrd.order_code}</span>
                              </span>
                              <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D]">
                                {cOrd.project_title}
                              </h3>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <span
                                className={
                                  cOrd.status === 'LUNAS'
                                    ? 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#0F2A1D] text-[#E3EED4]'
                                    : cOrd.status === 'SIAP_DIBAYAR'
                                    ? 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#375534] text-white'
                                    : 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071]'
                                }
                              >
                                {cOrd.status === 'LUNAS'
                                  ? '✓ LUNAS & TERKIRIM'
                                  : cOrd.status === 'SIAP_DIBAYAR'
                                  ? 'TAGIHAN TERKIRIM (MENUNGGU BAYAR)'
                                  : 'MENUNGGU PENGERJAAN ADMIN'}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDeleteCustomOrder(cOrd.id)}
                                className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                                title="Hapus Pesanan Kustom"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-[#0F2A1D] space-y-1 break-all">
                            <p>
                              <strong>Pemesan:</strong> {cOrd.customer_name} •{' '}
                              <strong>Email:</strong> {cOrd.customer_email}
                              {cOrd.customer_contact &&
                                ` • WA: ${cOrd.customer_contact}`}
                            </p>
                            <div className="p-3 rounded-xl bg-white border border-[#AEC3B0]/60 text-xs text-[#375534] whitespace-pre-line mt-1.5">
                              <strong className="text-[#0F2A1D] block mb-0.5">
                                Detail Permintaan Pelanggan:
                              </strong>
                              {cOrd.request_details}
                            </div>
                          </div>

                          {/* Kolom Upload Produk Kustom & Penentuan Harga Tagihan */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                            <div>
                              <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1">
                                1. Harga Tagihan Proyek Kustom (Rp) *
                              </label>
                              <input
                                type="number"
                                min="1000"
                                value={priceVal}
                                onChange={(e) =>
                                  setCustomPriceDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.value,
                                  }))
                                }
                                placeholder="Contoh: 150000"
                                className="w-full px-3.5 py-2.5 bg-white border border-[#AEC3B0] rounded-xl text-xs sm:text-sm font-bold text-[#0F2A1D]"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1">
                                2. Link Hasil Pengerjaan (Opsional — GDrive/Web)
                              </label>
                              <input
                                type="url"
                                value={linkVal}
                                onChange={(e) =>
                                  setCustomLinkDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.value,
                                  }))
                                }
                                placeholder="https://drive.google.com/..."
                                className="w-full px-3.5 py-2.5 bg-white border border-[#AEC3B0] rounded-xl text-xs sm:text-sm text-[#0F2A1D]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="p-3.5 rounded-2xl bg-[#E3EED4]/65 border border-dashed border-[#375534]">
                              <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1">
                                3. Upload File Produk Kustom yang Sudah Selesai
                              </label>
                              <input
                                type="file"
                                multiple
                                onChange={(e) =>
                                  setCustomFilesDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.files
                                      ? Array.from(e.target.files)
                                      : [],
                                  }))
                                }
                                className="text-xs text-[#0F2A1D] w-full mt-1"
                              />
                              {pickedFiles.length > 0 ? (
                                <p className="text-[11px] font-extrabold text-[#375534] mt-1.5">
                                  ✓ {pickedFiles.length} file baru siap diunggah
                                </p>
                              ) : cOrd.file_paths.length > 0 ? (
                                <p className="text-[11px] font-extrabold text-[#0F2A1D] mt-1.5">
                                  ✓ {cOrd.file_paths.length} file sudah terunggah
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1">
                                4. Catatan untuk Pelanggan (Dikirim ke Email):
                              </label>
                              <textarea
                                rows={2}
                                value={noteVal}
                                onChange={(e) =>
                                  setCustomNoteDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.value,
                                  }))
                                }
                                placeholder="Tuliskan pesan bahwa pesanan sudah siap dibayar..."
                                className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs text-[#0F2A1D]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleCompleteCustomOrderAndSendBill(cOrd)
                              }
                              className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm transition-colors"
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Mengunggah &amp; Mengirim Email...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 text-[#E3EED4]" />
                                  <span>
                                    {cOrd.status === 'SIAP_DIBAYAR'
                                      ? 'Perbarui Produk & Kirim Ulang Tagihan'
                                      : 'Tandai Produk Selesai & Kirim Tagihan via Email'}
                                  </span>
                                </>
                              )}
                            </button>

                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-bold"
                              >
                                Hubungi WA Pemesan
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                    Kotak Masuk Klaim Garansi &amp; Pertanyaan ({supportMessages.length})
                  </h2>
                  <p className="text-xs text-[#6B9071]">
                    Kelola laporan klaim garansi dan pesan dari pengunjung toko.
                  </p>
                </div>

                {supportMessages.length === 0 ? (
                  <p className="text-sm text-[#6B9071] text-center py-12">
                    Belum ada pesan masuk.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {supportMessages.map((msg) => {
                      const cleanWa = msg.sender_contact.replace(
                        /[^0-9]/g,
                        ''
                      );
                      const waLink = cleanWa
                        ? `https://wa.me/${
                            cleanWa.startsWith('0')
                              ? '62' + cleanWa.slice(1)
                              : cleanWa
                          }`
                        : null;

                      return (
                        <div
                          key={msg.id}
                          className={
                            msg.status === 'BARU'
                              ? 'p-4 rounded-2xl border min-w-0 bg-[#E3EED4]/45 border-[#6B9071]'
                              : 'p-4 rounded-2xl border min-w-0 bg-[#F6F8F3] border-[#AEC3B0]/60'
                          }
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E3EED4] text-[#0F2A1D] border border-[#6B9071]/50">
                                {msg.type === 'KLAIM_GARANSI'
                                  ? '🛡️ Klaim Garansi'
                                  : msg.type === 'LAYANAN_KHUSUS'
                                  ? `✨ Pesanan Kustom (${msg.invoice_number})`
                                  : '💬 Pertanyaan'}
                              </span>
                              <span className="font-extrabold text-sm text-[#0F2A1D]">
                                {msg.sender_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleToggleMessageStatus(msg)}
                                className={
                                  msg.status === 'BARU'
                                    ? 'px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 bg-[#0F2A1D] text-white'
                                    : 'px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 bg-white border border-[#AEC3B0] text-[#6B9071]'
                                }
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {msg.status === 'BARU'
                                    ? 'Tandai Selesai'
                                    : 'Selesai'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteSupportMessage(msg.id)
                                }
                                className="p-1.5 rounded-full bg-red-50 text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-[#0F2A1D] mb-2 break-all">
                            <strong>Email:</strong> {msg.sender_email}
                            {msg.sender_contact &&
                              ` • WA: ${msg.sender_contact}`}
                            {msg.invoice_number &&
                              ` • Kode/Invoice: ${msg.invoice_number}`}
                          </p>

                          <div className="p-3 rounded-xl bg-white border border-[#AEC3B0]/50 text-xs sm:text-sm text-[#0F2A1D] whitespace-pre-line break-words mb-3">
                            {msg.message}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 rounded-full bg-[#375534] text-white text-xs font-bold"
                              >
                                Balas via WhatsApp
                              </a>
                            )}
                            <a
                              href={`mailto:${msg.sender_email}?subject=Balasan%20Admin%20RizzFlow`}
                              className="px-3.5 py-1.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-bold"
                            >
                              Balas via Email
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* HALAMAN 4: KODE PROMO */}
        {/* ================================================================== */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-4">
                Buat Kode Promo Diskon Baru
              </h2>
              <form onSubmit={handleCreatePromo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Kode Promo (HEMAT20)"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm uppercase font-bold"
                  />
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={promoPercent}
                    onChange={(e) => setPromoPercent(e.target.value)}
                    placeholder="Diskon (%)"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    required
                    min="0"
                    value={promoMaxRp}
                    onChange={(e) => setPromoMaxRp(e.target.value)}
                    placeholder="Maks Potongan (Rp)"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="datetime-local"
                    required
                    value={promoStartsAt}
                    onChange={(e) => setPromoStartsAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={promoExpiresAt}
                    onChange={(e) => setPromoExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPromo}
                  className="px-6 py-3 rounded-full bg-[#0F2A1D] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan Kode Promo</span>
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h3 className="text-base font-extrabold text-[#0F2A1D] mb-4">
                Daftar Kode Promo ({promos.length})
              </h3>
              <div className="space-y-3">
                {promos.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60"
                  >
                    <div>
                      <span className="px-3 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs border border-[#6B9071]/50 mr-2">
                        {p.code}
                      </span>
                      <span className="font-bold text-sm text-[#0F2A1D]">
                        Diskon {p.discount_percent}% (Maks Rp
                        {p.max_discount_amount.toLocaleString('id-ID')})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(p)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-[#AEC3B0] bg-white"
                      >
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(p.id)}
                        className="p-2 rounded-full bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* HALAMAN 5: PENGATURAN TOKO, LAYANAN KUSTOM, & NOTIFIKASI TELEGRAM */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#375534]" />
                <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                  Pengaturan Layanan Kustom, Kontak &amp; Notifikasi Bot Telegram
                </h2>
              </div>
              <p className="text-xs text-[#6B9071] mb-5">
                Atur layanan kustom yang tampil di toko serta masukkan Bot Token &amp; Chat ID Telegram kamu agar setiap ada pembelian atau pesan masuk langsung dikirim ke Telegrammu.
              </p>

              <form
                onSubmit={handleSaveCustomServiceConfig}
                className="space-y-4"
              >
                {/* Kotak Konfigurasi Notifikasi Bot Telegram Admin */}
                <div className="p-4 rounded-2xl bg-[#E3EED4]/65 border border-[#6B9071] space-y-3">
                  <div className="text-xs font-extrabold text-[#0F2A1D]">
                    🔔 Notifikasi Otomatis ke Telegram Pribadimu (Saat Ada Pembelian / Pesan Baru)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                        Telegram Bot Token (Dari @BotFather)
                      </label>
                      <input
                        type="text"
                        value={customService.telegram_bot_token || ''}
                        onChange={(e) =>
                          setCustomService({
                            ...customService,
                            telegram_bot_token: e.target.value,
                          })
                        }
                        placeholder="Contoh: 7123456789:AAHxyz..."
                        className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                        Telegram Chat ID Kamu (Dari @userinfobot)
                      </label>
                      <input
                        type="text"
                        value={customService.telegram_chat_id || ''}
                        onChange={(e) =>
                          setCustomService({
                            ...customService,
                            telegram_chat_id: e.target.value,
                          })
                        }
                        placeholder="Contoh: 123456789"
                        className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                      Nomor WhatsApp Admin (Untuk Tombol Konsultasi)
                    </label>
                    <input
                      type="text"
                      value={customService.admin_whatsapp || ''}
                      onChange={(e) =>
                        setCustomService({
                          ...customService,
                          admin_whatsapp: e.target.value,
                        })
                      }
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                      Username / Link Telegram Admin (Opsional)
                    </label>
                    <input
                      type="text"
                      value={customService.admin_telegram || ''}
                      onChange={(e) =>
                        setCustomService({
                          ...customService,
                          admin_telegram: e.target.value,
                        })
                      }
                      placeholder="Contoh: @username_kamu"
                      className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Judul Etalase Layanan Kustom *
                  </label>
                  <input
                    type="text"
                    required
                    value={customService.title}
                    onChange={(e) =>
                      setCustomService({
                        ...customService,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Deskripsi Singkat Layanan Kustom *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={customService.description}
                    onChange={(e) =>
                      setCustomService({
                        ...customService,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0F2A1D]">
                      Daftar Layanan Kustom yang Tersedia *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddServiceItem}
                      className="px-3 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Layanan</span>
                    </button>
                  </div>

                  {customService.services.map((srv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={srv}
                        onChange={(e) =>
                          handleUpdateServiceItem(idx, e.target.value)
                        }
                        placeholder="Contoh: Pembuatan Web Sederhana / Template Excel Kustom"
                        className="flex-1 px-3.5 py-2 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-xs sm:text-sm"
                      />
                      {customService.services.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceItem(idx)}
                          className="p-2 rounded-full bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isSavingCustomService}
                  className="px-6 py-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm"
                >
                  {isSavingCustomService
                    ? 'Menyimpan...'
                    : 'Simpan Layanan Kustom & Notifikasi Telegram'}
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-1">
                Pengaturan Identitas Utama Toko
              </h2>
              <form onSubmit={handleSaveSettings} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Nama Toko
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.store_name}
                    onChange={(e) =>
                      setSettings({ ...settings, store_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Deskripsi Banner Halaman Utama
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={settings.banner_description}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        banner_description: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Kontak Bantuan Utama (Email / WhatsApp)
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.support_contact}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        support_contact: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs sm:text-sm"
                >
                  {isSavingSettings
                    ? 'Menyimpan...'
                    : 'Simpan Identitas Toko'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}