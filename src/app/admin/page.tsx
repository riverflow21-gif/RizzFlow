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
  DEFAULT_CUSTOM_SERVICE_CONFIG,
} from '@/lib/supabase';
import {
  Package,
  FolderTree,
  TicketPercent,
  ShoppingBag,
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
} from 'lucide-react';
import {
  Category,
  Product,
  PromoCode,
  Order,
  StoreSettings,
} from '@/types';

type AdminTab =
  | 'products'
  | 'messages'
  | 'orders'
  | 'categories'
  | 'promos'
  | 'settings';

interface FeedbackBanner {
  type: 'success' | 'error';
  message: string;
}

interface PendingCounts {
  paidOrders: number;
  unreadMsgs: number;
}

interface PwaInstallEvent extends Event {
  prompt: () => Promise<void>;
}

type NullableFeedback = FeedbackBanner | null;
type NullablePwaEvent = PwaInstallEvent | null;
type NullablePendingCounts = PendingCounts | null;
type NullableProduct = Product | null;
type NullableString = string | null;

/**
 * Membunyikan nada dering alarm di HP/Laptop Admin saat ada pesanan lunas atau pesan klaim baru.
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
  const [activeTab, setActiveTab] = useState('products' as AdminTab);
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

  // State Form Tambah & Edit Produk Digital Instan
  const [editingProduct, setEditingProduct] = useState(
    null as NullableProduct
  );
  const [adminProductSearch, setAdminProductSearch] = useState('');
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

  // State Form Kategori & Kode Promo
  const [catName, setCatName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoPercent, setPromoPercent] = useState('20');
  const [promoMaxRp, setPromoMaxRp] = useState('15000');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoExpiresAt, setPromoExpiresAt] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  // State Pengaturan Toko & Kirim Ulang Email
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingCustomService, setIsSavingCustomService] = useState(false);
  const [resendingOrderId, setResendingOrderId] = useState(
    null as NullableString
  );

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
      showMessage('error', 'Browser HP kamu belum mendukung fitur notifikasi.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotifPermission(permission);

    if (permission === 'granted') {
      playAdminNotificationBeep();
      new Notification('Notifikasi Admin RizzFlow Aktif!', {
        body: 'HP kamu akan berbunyi saat ada pesanan lunas atau pesan klaim baru.',
        icon: '/logo.jpg',
      });
      showMessage(
        'success',
        'Notifikasi HP dan bunyi alarm berhasil diaktifkan!'
      );
    } else {
      showMessage(
        'error',
        'Izin notifikasi ditolak. Aktifkan izin notifikasi di pengaturan browser kamu.'
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
        'Untuk menjadikan aplikasi di HP: Klik menu titik tiga di pojok kanan atas browser Chrome/Safari kamu, lalu pilih "Tambahkan ke Layar Utama" (Add to Home Screen).'
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

          if (msgRes.ok) {
            const msgData = (await msgRes.json()) as {
              messages?: CustomerSupportMessage[];
              customServiceConfig?: CustomServiceConfig;
            };
            if (msgData.messages) {
              setSupportMessages(msgData.messages);
              currentUnreadMsgs = msgData.messages.filter(
                (m) => m.status === 'BARU'
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
              currentUnreadMsgs > prev.unreadMsgs
            ) {
              playAdminNotificationBeep();
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification('Notifikasi Baru di RizzFlow!', {
                  body:
                    currentPaidCount > prev.paidOrders
                      ? 'Ada pesanan produk digital baru yang telah dibayar lunas!'
                      : 'Ada pesan klaim garansi / layanan kustom baru yang masuk!',
                  icon: '/logo.jpg',
                });
              }
            }
          }

          prevCountsRef.current = {
            paidOrders: currentPaidCount,
            unreadMsgs: currentUnreadMsgs,
          };
        } catch (e) {
          console.error('Gagal memuat pesan pelanggan:', e);
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

  // Polling otomatis setiap 15 detik untuk mengecek pesanan atau klaim baru
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
  };

  // ==========================================================================
  // 1. LOGIKA MANAJEMEN PRODUK DIGITAL (TAMBAH BARU, EDIT, & PENCARIAN)
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
        'Harap unggah minimal 1 File Produk ATAU masukkan minimal 1 Link Produk (seperti Google Drive).'
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
        product_type: 'INSTAN',
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
        showMessage('success', 'Produk baru berhasil disimpan!');
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
      showMessage('success', 'Status produk diperbarui.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Produk berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 2. LOGIKA KATEGORI, PROMO, PESAN, & PENGATURAN
  // ==========================================================================
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
      showMessage('success', 'Kategori baru ditambahkan!');
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
      showMessage('success', 'Kategori dihapus.');
    }
  };

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
      showMessage('success', 'Status promo diperbarui.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Kode promo dihapus.');
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
      body: JSON.stringify({ id: msg.id, status: nextStatus }),
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
        err instanceof Error ? err.message : 'Gagal menyimpan.'
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
        throw new Error(data.error || 'Gagal menyimpan Layanan Kustom.');
      }
      if (data.customServiceConfig) setCustomService(data.customServiceConfig);
      showMessage(
        'success',
        data.message || 'Pengaturan Layanan Kustom disimpan!'
      );
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan Layanan Kustom.'
      );
    } finally {
      setIsSavingCustomService(false);
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="min-h-screen bg-[#F6F8F3] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0F2A1D]">
          <Loader2 className="w-5 h-5 animate-spin text-[#375534]" />
          <span>Memuat Panel Admin RizzFlow...</span>
        </div>
      </div>
    );
  }

  const paidOrdersList = orders.filter((o) => o.payment_status === 'PAID');
  const totalPaidRevenue = paidOrdersList.reduce(
    (acc, o) => acc + o.final_amount,
    0
  );

  const unreadMessagesCount = supportMessages.filter(
    (m) => m.status === 'BARU'
  ).length;

  const navBtnClass = (tab: AdminTab) =>
    activeTab === tab
      ? 'flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors bg-[#0F2A1D] text-[#E3EED4] shadow-sm'
      : 'flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors text-[#375534] hover:bg-[#E3EED4]/60 hover:text-[#0F2A1D]';

  const renderSidebarNavItems = () => (
    <nav className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => selectTab('products')}
        className={navBtnClass('products')}
      >
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4 shrink-0" />
          <span>Produk ({products.length})</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => selectTab('messages')}
        className={navBtnClass('messages')}
      >
        <div className="flex items-center gap-3">
          <Inbox className="w-4 h-4 shrink-0" />
          <span>Pesan &amp; Klaim</span>
        </div>
        {unreadMessagesCount > 0 && (
          <span
            className={
              activeTab === 'messages'
                ? 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#E3EED4] text-[#0F2A1D]'
                : 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#375534] text-white'
            }
          >
            {unreadMessagesCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => selectTab('orders')}
        className={navBtnClass('orders')}
      >
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-4 h-4 shrink-0" />
          <span>Riwayat Pembelian ({orders.length})</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => selectTab('categories')}
        className={navBtnClass('categories')}
      >
        <div className="flex items-center gap-3">
          <FolderTree className="w-4 h-4 shrink-0" />
          <span>Kategori ({categories.length})</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => selectTab('promos')}
        className={navBtnClass('promos')}
      >
        <div className="flex items-center gap-3">
          <TicketPercent className="w-4 h-4 shrink-0" />
          <span>Kode Promo ({promos.length})</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => selectTab('settings')}
        className={navBtnClass('settings')}
      >
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 shrink-0" />
          <span>Pengaturan &amp; Kustom</span>
        </div>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F6F8F3] text-[#0F2A1D] flex flex-col md:flex-row overflow-x-hidden">
      {/* HEADER ATAS KHUSUS HP */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#AEC3B0]/50 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#F6F8F3] hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/60 relative"
            aria-label="Buka Menu Samping"
          >
            <Menu className="w-5 h-5 text-[#0F2A1D]" />
            {unreadMessagesCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#375534] absolute -top-0.5 -right-0.5" />
            )}
          </button>
          <span className="font-extrabold text-sm text-[#0F2A1D] truncate">
            Admin {settings.store_name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="p-2 rounded-lg bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/60"
            title="Lihat Toko"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold inline-flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* SIDE NAVBAR DRAWER DI SAMPING KIRI (UNTUK LAYAR HP) */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-[#0F2A1D]/60 backdrop-blur-xs md:hidden flex"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-64 bg-white h-full shadow-2xl flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#AEC3B0]/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/logo.jpg"
                    alt="Logo"
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-[#0F2A1D] truncate">
                      {settings.store_name}
                    </div>
                    <div className="text-[11px] text-[#6B9071] truncate">
                      {adminEmail}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-[#6B9071] hover:bg-[#F6F8F3]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderSidebarNavItems()}
            </div>

            <div className="pt-4 border-t border-[#AEC3B0]/40 space-y-2">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0F2A1D] bg-[#E3EED4]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Lihat Halaman Toko</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVBAR TETAP DI SAMPING KIRI (UNTUK DESKTOP/LAPTOP) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-[#AEC3B0]/50 shrink-0 flex-col justify-between min-h-screen sticky top-0">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.jpg"
                alt={settings.store_name}
                className="h-9 w-9 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="font-extrabold text-base text-[#0F2A1D] truncate">
                  {settings.store_name}
                </div>
                <div className="text-[11px] text-[#6B9071] truncate">
                  {adminEmail}
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="p-2 rounded-lg bg-[#F6F8F3] hover:bg-[#E3EED4] text-[#0F2A1D] border border-[#AEC3B0]/60"
              title="Lihat Halaman Toko"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {renderSidebarNavItems()}
        </div>

        <div className="p-4 border-t border-[#AEC3B0]/40">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Area Konten Utama Admin */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-5xl w-full mx-auto overflow-x-hidden">
        {/* Baris Aplikasi Mobile Admin (PWA) & Pengaktif Notifikasi Bunyi di HP */}
        <div className="mb-5 p-4 rounded-2xl bg-[#E3EED4] border border-[#AEC3B0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#0F2A1D]">
            <strong className="font-extrabold text-[#0F2A1D]">
              📱 Mode Aplikasi Mobile Admin &amp; Alarm Pesanan:
            </strong>{' '}
            Pasang halaman Admin ini di layar utama HP kamu dan aktifkan alarm agar berbunyi saat ada pesanan atau pesan masuk.
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleEnableBrowserNotifications}
              className={
                notifPermission === 'granted'
                  ? 'px-3.5 py-2 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 border bg-white text-[#375534] border-[#6B9071]'
                  : 'px-3.5 py-2 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 bg-[#375534] text-white'
              }
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {notifPermission === 'granted'
                  ? 'Notif & Suara Aktif'
                  : 'Aktifkan Notif HP'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleInstallPwaApp}
              className="px-3.5 py-2 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Jadikan Aplikasi HP</span>
            </button>
          </div>
        </div>

        {/* Ringkasan Statistik Cepat */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-[#AEC3B0]/60 rf-card-shadow min-w-0">
            <span className="text-xs text-[#6B9071] font-bold">
              Total Pendapatan Lunas
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#375534] mt-1 truncate">
              Rp{totalPaidRevenue.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#AEC3B0]/60 rf-card-shadow min-w-0">
            <span className="text-xs text-[#6B9071] font-bold">
              Pesanan Lunas
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F2A1D] mt-1">
              {paidOrdersList.length} Transaksi
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#AEC3B0]/60 rf-card-shadow col-span-2 sm:col-span-1 min-w-0">
            <span className="text-xs text-[#6B9071] font-bold">
              Pesan &amp; Klaim Masuk
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F2A1D] mt-1">
              {unreadMessagesCount} Belum Dibaca
            </div>
          </div>
        </div>

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
        {/* TAB 1: MANAJEMEN PRODUK DIGITAL INSTAN */}
        {/* ================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                    {editingProduct
                      ? `Edit Produk: ${editingProduct.title}`
                      : 'Tambah Produk Digital Baru'}
                  </h2>
                  <p className="text-xs text-[#6B9071] mt-0.5">
                    {editingProduct
                      ? 'Ubah rincian di bawah ini lalu klik Simpan Perubahan. Kosongkan input gambar/file jika tidak ingin mengganti gambar/file lama.'
                      : 'Mendukung fitur Harga Coret, multi-gambar sampul, multi-file unduhan, dan link Google Drive.'}
                  </p>
                </div>

                {editingProduct && (
                  <button
                    type="button"
                    onClick={handleCancelEditProduct}
                    className="self-start sm:self-center px-3.5 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                    <span>Batal Edit</span>
                  </button>
                )}
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
                      <span>Tambah Link</span>
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

                  {editingProduct && (
                    <button
                      type="button"
                      onClick={handleCancelEditProduct}
                      className="px-5 py-3 rounded-full bg-[#E3EED4] hover:bg-[#AEC3B0] text-[#0F2A1D] font-bold text-xs sm:text-sm"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Daftar Katalog Produk Dilengkapi Kolom Pencarian & Tombol Edit */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-[#0F2A1D]">
                  Daftar Katalog Produk ({products.length})
                </h3>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-[#6B9071] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={adminProductSearch}
                    onChange={(e) => setAdminProductSearch(e.target.value)}
                    placeholder="Cari nama produk untuk diedit..."
                    className="w-full pl-9 pr-8 py-2 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-xs text-[#0F2A1D] focus:outline-none focus:border-[#375534]"
                  />
                  {adminProductSearch && (
                    <button
                      type="button"
                      onClick={() => setAdminProductSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B9071] hover:text-[#0F2A1D]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {products.length === 0 ? (
                <p className="text-sm text-[#6B9071] py-6 text-center">
                  Belum ada produk di katalog.
                </p>
              ) : (
                <div className="space-y-3">
                  {products
                    .filter((p) => {
                      const q = adminProductSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.title.toLowerCase().includes(q) ||
                        p.description.toLowerCase().includes(q)
                      );
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
                              src={thumbs[0] || '/logo.jpg'}
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
        {/* TAB 2: PESAN PELANGGAN, KLAIM GARANSI & JASA KUSTOM */}
        {/* ================================================================== */}
        {activeTab === 'messages' && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
            <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-1">
              Kotak Masuk Pesan, Klaim Garansi &amp; Layanan Kustom ({supportMessages.length})
            </h2>
            <p className="text-xs text-[#6B9071] mb-5">
              Seluruh pengaduan garansi dan pesanan jasa kustom dari halaman Layanan masuk ke sini.
            </p>

            {supportMessages.length === 0 ? (
              <p className="text-sm text-[#6B9071] text-center py-12">
                Belum ada pesan yang masuk.
              </p>
            ) : (
              <div className="space-y-3.5">
                {supportMessages.map((msg) => {
                  const cleanWa = msg.sender_contact.replace(/[^0-9]/g, '');
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
                              ? '✨ Pesan Jasa Kustom'
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
                            onClick={() => handleDeleteSupportMessage(msg.id)}
                            className="p-1.5 rounded-full bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#0F2A1D] mb-2 break-all">
                        <strong>Email:</strong> {msg.sender_email}
                        {msg.sender_contact && ` • WA: ${msg.sender_contact}`}
                        {msg.invoice_number &&
                          ` • Invoice: #${msg.invoice_number}`}
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

        {/* ================================================================== */}
        {/* TAB 3: RIWAYAT PEMBELIAN */}
        {/* ================================================================== */}
        {activeTab === 'orders' && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
            <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-4">
              Riwayat Pembelian Pelanggan ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[#6B9071] text-center py-10">
                Belum ada riwayat pesanan.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#0F2A1D]">
                          #{ord.invoice_number}
                        </span>
                        <span
                          className={
                            ord.payment_status === 'PAID'
                              ? 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E3EED4] text-[#0F2A1D]'
                              : 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800'
                          }
                        >
                          {ord.payment_status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#0F2A1D] break-all">
                        Email:{' '}
                        <span className="text-[#375534]">
                          {ord.customer_email}
                        </span>
                      </p>
                      <div className="text-sm font-extrabold text-[#0F2A1D]">
                        Total: Rp{ord.final_amount.toLocaleString('id-ID')}
                      </div>
                    </div>

                    {ord.payment_status === 'PAID' && (
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
        )}

        {/* ================================================================== */}
        {/* TAB 4: KATEGORI */}
        {/* ================================================================== */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-4">
                Tambah Kategori Produk
              </h2>
              <form onSubmit={handleCreateCategory} className="flex gap-3">
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Contoh: E-Book / Template Excel"
                  className="flex-1 min-w-0 px-4 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-full text-sm"
                />
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-5 py-2.5 rounded-full bg-[#0F2A1D] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h3 className="text-base font-extrabold text-[#0F2A1D] mb-4">
                Daftar Kategori ({categories.length})
              </h3>
              <div className="space-y-2.5">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50"
                  >
                    <span className="font-bold text-sm text-[#0F2A1D]">
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 rounded-full text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: KODE PROMO */}
        {/* ================================================================== */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-4">
                Buat Kode Promo Baru
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
        {/* TAB 6: PENGATURAN TOKO & LAYANAN KUSTOM */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#375534]" />
                <h2 className="text-lg font-extrabold text-[#0F2A1D]">
                  Pengaturan Layanan Kustom &amp; Kontak Admin
                </h2>
              </div>
              <p className="text-xs text-[#6B9071] mb-5">
                Atur judul, deskripsi, daftar layanan kustom, serta nomor WhatsApp dan username Telegram Admin untuk konsultasi pelanggan.
              </p>

              <form
                onSubmit={handleSaveCustomServiceConfig}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                      Nomor WhatsApp Admin (Opsional)
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
                      Username Telegram Admin (Opsional)
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
                      placeholder="Contoh: @rizzflow_admin"
                      className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0]/60 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Judul Layanan Kustom *
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
                      Daftar Layanan yang Tersedia *
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
                  className="px-6 py-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-bold text-xs sm:text-sm"
                >
                  {isSavingCustomService
                    ? 'Menyimpan...'
                    : 'Simpan Pengaturan Layanan Kustom'}
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
              <h2 className="text-lg font-extrabold text-[#0F2A1D] mb-1">
                Pengaturan Identitas Toko
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
                    Kontak Bantuan (Email / WhatsApp)
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
                  className="px-6 py-3 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-bold text-xs sm:text-sm"
                >
                  {isSavingSettings
                    ? 'Menyimpan...'
                    : 'Simpan Pengaturan Toko'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}