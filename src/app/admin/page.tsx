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
  SubscriptionOrder,
  SubscriptionOrderStatus,
  ProductSaleType,
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
  Crown,
  BellRing,
  Smartphone,
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
  | 'subscriptions'
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
  subs: number;
  msgs: number;
}

interface PwaInstallEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Membunyikan nada dering alarm di HP/Laptop Admin saat ada antrian langganan atau klaim baru.
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
  const [feedback, setFeedback] = useState(null as FeedbackBanner | null);

  // State Aplikasi Mobile Admin (PWA) & Notifikasi HP
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(
    null as PwaInstallEvent | null
  );
  const [notifPermission, setNotifPermission] = useState('default');
  const prevPendingCountsRef = useRef(null as PendingCounts | null);

  // State Data Utama
  const [products, setProducts] = useState([] as Product[]);
  const [categories, setCategories] = useState([] as Category[]);
  const [promos, setPromos] = useState([] as PromoCode[]);
  const [orders, setOrders] = useState([] as Order[]);
  const [supportMessages, setSupportMessages] = useState(
    [] as CustomerSupportMessage[]
  );
  const [subscriptions, setSubscriptions] = useState(
    [] as SubscriptionOrder[]
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

  // State Form Tambah Produk Baru (Instan & Langganan)
  const [prodSaleType, setProdSaleType] = useState('INSTAN' as ProductSaleType);
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
  const [editingProduct, setEditingProduct] = useState(null as Product | null);
  const [adminProductSearch, setAdminProductSearch] = useState('');

  // State Input Keterangan & Detail Akun Langganan
  const [subNotesDraft, setSubNotesDraft] = useState(
    {} as { [key: string]: string }
  );
  const [subAccountDraft, setSubAccountDraft] = useState(
    {} as { [key: string]: string }
  );
  const [updatingSubId, setUpdatingSubId] = useState(null as string | null);

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
    null as string | null
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
        body: 'HP kamu akan berbunyi saat ada antrian langganan atau klaim baru.',
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
      if (orderRes.data) setOrders(orderRes.data as Order[]);
      if (setRes.data) setSettings(setRes.data as StoreSettings);

      if (tokenToUse) {
        try {
          const [msgRes, subRes] = await Promise.all([
            fetch('/api/messages', {
              headers: { Authorization: `Bearer ${tokenToUse}` },
            }),
            fetch('/api/subscriptions', {
              headers: { Authorization: `Bearer ${tokenToUse}` },
            }),
          ]);

          let newUnreadMsgs = 0;
          let newWaitingSubs = 0;

          if (msgRes.ok) {
            const msgData = (await msgRes.json()) as {
              messages?: CustomerSupportMessage[];
              customServiceConfig?: CustomServiceConfig;
            };
            if (msgData.messages) {
              setSupportMessages(msgData.messages);
              newUnreadMsgs = msgData.messages.filter(
                (m) => m.status === 'BARU'
              ).length;
            }
            if (msgData.customServiceConfig && !isBackgroundPoll) {
              setCustomService(msgData.customServiceConfig);
            }
          }

          if (subRes.ok) {
            const subData = (await subRes.json()) as {
              subscriptions?: SubscriptionOrder[];
            };
            if (subData.subscriptions) {
              setSubscriptions(subData.subscriptions);
              newWaitingSubs = subData.subscriptions.filter(
                (s) =>
                  s.status === 'MENUNGGU_ADMIN' || s.status === 'DIPROSES'
              ).length;
            }
          }

          if (prevPendingCountsRef.current) {
            const prev = prevPendingCountsRef.current;
            if (newWaitingSubs > prev.subs || newUnreadMsgs > prev.msgs) {
              playAdminNotificationBeep();
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification('Pesanan / Pesan Baru di RizzFlow!', {
                  body:
                    newWaitingSubs > prev.subs
                      ? 'Ada pelanggan baru yang mengambil Kode Antrian 4 Angka (Produk Langganan)!'
                      : 'Ada pesan klaim garansi / layanan kustom baru yang masuk!',
                  icon: '/logo.jpg',
                });
              }
            }
          }

          prevPendingCountsRef.current = {
            subs: newWaitingSubs,
            msgs: newUnreadMsgs,
          };
        } catch (e) {
          console.error('Gagal memuat pesan & antrian langganan:', e);
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

  // Polling otomatis setiap 15 detik agar aplikasi Admin langsung berbunyi jika ada pesanan baru
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
  // 1. LOGIKA MANAJEMEN PRODUK (INSTAN & LANGGANAN)
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

  // Fungsi mengisi form saat tombol "Edit" pada daftar produk diklik
  const handleStartEditProduct = (product: Product) => {
    const deliverables = parseProductDeliverables(product.file_path);
    setEditingProduct(product);
    setProdSaleType(deliverables.product_type || 'INSTAN');
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

  // Fungsi membatalkan mode Edit dan mengosongkan kembali form
  const handleCancelEditProduct = () => {
    setEditingProduct(null);
    setProdSaleType('INSTAN');
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

    // Jika tambah produk baru (bukan edit), wajib pilih minimal 1 gambar thumbnail
    if (!editingProduct && thumbnailFiles.length === 0) {
      showMessage('error', 'Harap pilih minimal 1 Gambar Sampul (Thumbnail).');
      return;
    }

    const hasExistingFiles =
      existingDeliverables && existingDeliverables.files.length > 0;

    if (
      prodSaleType === 'INSTAN' &&
      digitalFiles.length === 0 &&
      !hasExistingFiles &&
      validLinks.length === 0
    ) {
      showMessage(
        'error',
        'Untuk Produk Instan, harap unggah minimal 1 File Produk ATAU masukkan minimal 1 Link Produk.'
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

      // Jika Admin memilih gambar thumbnail baru, unggah ke Supabase Storage
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

      // Jika Admin memilih file produk baru, unggah ke Supabase Storage
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
        files: prodSaleType === 'INSTAN' ? uploadedFilePaths : [],
        links: prodSaleType === 'INSTAN' ? validLinks : [],
        original_price: numericOriginalPrice,
        product_type: prodSaleType,
      });

      if (editingProduct) {
        // Simpan Perubahan Produk yang Sedang Diedit
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
        // Simpan Produk Baru
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
  // 2. LOGIKA LAYANAN LANGGANAN (KODE ANTRIAN 4 ANGKA)
  // ==========================================================================
  const handleUpdateSubscriptionStatus = async (params: {
    sub: SubscriptionOrder;
    nextStatus: SubscriptionOrderStatus;
    defaultNote: string;
  }) => {
    setUpdatingSubId(params.sub.id);
    try {
      const customNote =
        subNotesDraft[params.sub.id] !== undefined
          ? subNotesDraft[params.sub.id]
          : params.defaultNote;
      const customAccount =
        subAccountDraft[params.sub.id] !== undefined
          ? subAccountDraft[params.sub.id]
          : params.sub.delivered_account;

      const res = await fetch('/api/subscriptions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: params.sub.id,
          status: params.nextStatus,
          admin_note: customNote,
          delivered_account: customAccount,
        }),
      });

      const data = (await res.json()) as {
        subscriptions?: SubscriptionOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui status langganan.');
      }

      if (data.subscriptions) setSubscriptions(data.subscriptions);
      showMessage(
        'success',
        data.message || 'Status langganan berhasil diperbarui & email terkirim!'
      );
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal memperbarui status.'
      );
    } finally {
      setUpdatingSubId(null);
    }
  };

  const handleDeleteSubscriptionOrder = async (id: string) => {
    const res = await fetch(`/api/subscriptions?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        subscriptions?: SubscriptionOrder[];
      };
      if (data.subscriptions) setSubscriptions(data.subscriptions);
      showMessage('success', 'Data antrian langganan dihapus.');
    }
  };

  // ==========================================================================
  // 3. LOGIKA KATEGORI, PROMO, PESAN, & PENGATURAN
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
          <Loader2 className="w-5 h-5 animate-spin text-[#10B981]" />
          <span>Memuat Panel Admin RizzFlow...</span>
        </div>
      </div>
    );
  }

  const totalPaidRevenue = orders
    .filter((o) => o.payment_status === 'PAID')
    .reduce((acc, o) => acc + o.final_amount, 0);

  const unreadMessagesCount = supportMessages.filter(
    (m) => m.status === 'BARU'
  ).length;

  const waitingSubscriptionsCount = subscriptions.filter(
    (s) => s.status === 'MENUNGGU_ADMIN' || s.status === 'DIPROSES'
  ).length;

  const navBtnClass = (tab: AdminTab) =>
    activeTab === tab
      ? 'flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors bg-[#10B981] text-white shadow-sm'
      : 'flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]';

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
        onClick={() => selectTab('subscriptions')}
        className={navBtnClass('subscriptions')}
      >
        <div className="flex items-center gap-3">
          <Crown className="w-4 h-4 shrink-0" />
          <span>Layanan Langganan</span>
        </div>
        {waitingSubscriptionsCount > 0 && (
          <span
            className={
              activeTab === 'subscriptions'
                ? 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-white text-[#059669]'
                : 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500 text-white'
            }
          >
            {waitingSubscriptionsCount}
          </span>
        )}
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
                ? 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-white text-[#059669]'
                : 'px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white'
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row overflow-x-hidden">
      {/* HEADER ATAS KHUSUS HP */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200 relative"
            aria-label="Buka Menu Samping"
          >
            <Menu className="w-5 h-5 text-[#10B981]" />
            {(unreadMessagesCount > 0 || waitingSubscriptionsCount > 0) && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5" />
            )}
          </button>
          <span className="font-extrabold text-sm text-[#0F172A] truncate">
            Admin {settings.store_name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="p-2 rounded-lg bg-[#F8FAFC] text-[#059669] border border-slate-200"
            title="Lihat Toko"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-[#EF4444] text-xs font-bold inline-flex items-center gap-1"
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
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:hidden flex"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-64 bg-white h-full shadow-2xl flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/logo.jpg"
                    alt="Logo"
                    className="h-8 w-auto rounded-lg object-contain"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-[#0F172A] truncate">
                      {settings.store_name}
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate">
                      {adminEmail}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderSidebarNavItems()}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#059669] bg-[#ECFDF5]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Lihat Halaman Toko</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#EF4444] bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVBAR TETAP DI SAMPING KIRI (UNTUK DESKTOP/LAPTOP) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 shrink-0 flex-col justify-between min-h-screen sticky top-0">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.jpg"
                alt={settings.store_name}
                className="h-9 w-auto rounded-lg object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="font-extrabold text-base text-[#0F172A] truncate">
                  {settings.store_name}
                </div>
                <div className="text-[11px] text-[#64748B] truncate">
                  {adminEmail}
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#059669] border border-slate-200"
              title="Lihat Halaman Toko"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {renderSidebarNavItems()}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#EF4444] bg-red-50 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Area Konten Utama Admin */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-5xl w-full mx-auto overflow-x-hidden">
        {/* Baris Aplikasi Mobile Admin (PWA) & Pengaktif Notifikasi Bunyi di HP */}
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-[#ECFDF5] to-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#0F172A]">
            <strong className="font-extrabold text-[#059669]">
              📱 Mode Aplikasi Mobile Admin &amp; Alarm Pesanan:
            </strong>{' '}
            Pasang halaman Admin ini di layar utama HP kamu dan nyalakan alarm notifikasi agar langsung berbunyi saat ada pesanan masuk.
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleEnableBrowserNotifications}
              className={
                notifPermission === 'granted'
                  ? 'px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors bg-white text-[#059669] border-emerald-300'
                  : 'px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors bg-[#10B981] text-white border-[#10B981]'
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
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Jadikan Aplikasi HP</span>
            </button>
          </div>
        </div>

        {/* Ringkasan Statistik Cepat */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 min-w-0">
            <span className="text-xs text-[#64748B] font-semibold">
              Total Pendapatan Lunas
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#10B981] mt-1 truncate">
              Rp{totalPaidRevenue.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 min-w-0">
            <span className="text-xs text-[#64748B] font-semibold">
              Antrian Langganan Aktif
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-amber-600 mt-1">
              {waitingSubscriptionsCount} Antrian
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 col-span-2 sm:col-span-1 min-w-0">
            <span className="text-xs text-[#64748B] font-semibold">
              Pesan &amp; Klaim Masuk
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F172A] mt-1">
              {unreadMessagesCount} Belum Dibaca
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={
              feedback.type === 'success'
                ? 'mb-6 p-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 break-words bg-[#ECFDF5] border-emerald-200 text-[#059669]'
                : 'mb-6 p-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 break-words bg-red-50 border-red-200 text-[#EF4444]'
            }
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.message}</span>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 1: MANAJEMEN PRODUK DIGITAL (INSTAN & LANGGANAN) */}
        {/* ================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F172A]">
                    {editingProduct
                      ? `Edit Produk: ${editingProduct.title}`
                      : 'Tambah Produk Baru (File Instan / Produk Langganan)'}
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {editingProduct
                      ? 'Ubah rincian di bawah ini lalu klik Simpan Perubahan. Kosongkan input gambar/file jika tidak ingin mengganti gambar/file lama.'
                      : 'Pilih apakah produk ini berupa File/Link Instan atau Produk Tipe Langganan.'}
                  </p>
                </div>

                {editingProduct && (
                  <button
                    type="button"
                    onClick={handleCancelEditProduct}
                    className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#EF4444] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                    <span>Batal Edit</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#F8FAFC] p-2 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setProdSaleType('INSTAN')}
                    className={
                      prodSaleType === 'INSTAN'
                        ? 'py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all bg-[#10B981] text-white shadow-sm'
                        : 'py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all text-[#64748B] hover:text-[#0F172A]'
                    }
                  >
                    ⚡ Produk File / Link Instan (Otomatis Terkirim)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProdSaleType('LANGGANAN')}
                    className={
                      prodSaleType === 'LANGGANAN'
                        ? 'py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all bg-amber-500 text-white shadow-sm'
                        : 'py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all text-[#64748B] hover:text-[#0F172A]'
                    }
                  >
                    👑 Produk Tipe Langganan (Opsi WA/Tele &amp; Kode 4 Angka)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Nama Produk *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodTitle}
                      onChange={(e) => setProdTitle(e.target.value)}
                      placeholder={
                        prodSaleType === 'LANGGANAN'
                          ? 'Contoh: Netflix Premium 1 Bulan / CapCut Pro'
                          : 'Contoh: Paket E-Book & Template Excel'
                      }
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Kategori Produk *
                    </label>
                    <select
                      value={prodCategoryId}
                      onChange={(e) => setProdCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
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
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Harga Jual Saat Ini (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="Contoh: 35000"
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#059669] mb-1">
                      Harga Asli / Harga Coret (Opsional — Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={prodOriginalPrice}
                      onChange={(e) => setProdOriginalPrice(e.target.value)}
                      placeholder="Contoh: 99000"
                      className="w-full px-3.5 py-2.5 bg-[#ECFDF5]/40 border border-emerald-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Label Badge (Opsional)
                  </label>
                  <input
                    type="text"
                    value={prodBadge}
                    onChange={(e) => setProdBadge(e.target.value)}
                    placeholder="Contoh: Terlaris / Garansi Penuh"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Deskripsi Lengkap Produk *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Jelaskan detail produk, durasi langganan, atau isi file..."
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-slate-300 min-w-0">
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                      className="text-xs text-[#0F172A] w-full mt-1"
                    />
                    {thumbnailFiles.length > 0 && (
                      <p className="text-[11px] font-bold text-[#059669] mt-2 break-all">
                        ✓ {thumbnailFiles.length} gambar baru dipilih
                      </p>
                    )}
                  </div>

                  {prodSaleType === 'INSTAN' ? (
                    <div className="p-4 rounded-xl bg-[#ECFDF5]/60 border border-dashed border-emerald-300 min-w-0">
                      <label className="block text-xs font-bold text-[#059669] mb-1">
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
                        className="text-xs text-[#0F172A] w-full mt-1"
                      />
                      {digitalFiles.length > 0 && (
                        <p className="text-[11px] font-bold text-[#059669] mt-2 break-all">
                          ✓ {digitalFiles.length} file baru dipilih
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col justify-center">
                      <strong>👑 Mode Produk Langganan Aktif:</strong>
                      <p className="mt-1">
                        Saat pelanggan memilih produk ini di toko, pelanggan langsung diberi pilihan untuk <strong>Chat WA / Telegram Admin</strong> atau mengambil <strong>Kode Antrian 4 Angka</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {prodSaleType === 'INSTAN' && (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold text-[#0F172A]">
                        2B. Link Produk Eksternal / Google Drive (Opsional)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddLinkRow}
                        className="px-3 py-1.5 rounded-lg bg-[#ECFDF5] hover:bg-emerald-100 text-[#059669] text-xs font-bold inline-flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Link</span>
                      </button>
                    </div>

                    {productLinks.map((linkVal, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <LinkIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            value={linkVal}
                            onChange={(e) =>
                              handleUpdateLinkRow(idx, e.target.value)
                            }
                            placeholder="https://drive.google.com/..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                          />
                        </div>
                        {productLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkRow(idx)}
                            className="p-2 rounded-lg text-[#EF4444] hover:bg-red-50 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSavingProduct}
                    className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors"
                  >
                    {isSavingProduct ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
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
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold text-sm"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Daftar Katalog Produk Dilengkapi Kolom Pencarian & Tombol Edit */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  Daftar Katalog Produk ({products.length})
                </h3>

                {/* Kolom Pencarian Produk di Halaman Admin */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={adminProductSearch}
                    onChange={(e) => setAdminProductSearch(e.target.value)}
                    placeholder="Cari nama produk untuk diedit..."
                    className="w-full pl-3.5 pr-8 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                  />
                  {adminProductSearch && (
                    <button
                      type="button"
                      onClick={() => setAdminProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {products.length === 0 ? (
                <p className="text-sm text-[#64748B] py-6 text-center">
                  Belum ada produk.
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
                      const isSub = deliverables.product_type === 'LANGGANAN';

                      return (
                        <div
                          key={prod.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 min-w-0"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={thumbs[0] || ''}
                              alt={prod.title}
                              className="w-14 h-14 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={
                                    isSub
                                      ? 'px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800'
                                      : 'px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#ECFDF5] text-[#059669]'
                                  }
                                >
                                  {isSub ? '👑 Langganan' : '⚡ Instan'}
                                </span>
                                <h4 className="font-bold text-sm text-[#0F172A] break-words">
                                  {prod.title}
                                </h4>
                                {!prod.is_active && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                                    Disembunyikan
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-extrabold text-[#10B981]">
                                  Rp{prod.price.toLocaleString('id-ID')}
                                </span>
                                {deliverables.original_price &&
                                  deliverables.original_price > prod.price && (
                                    <span className="text-[11px] text-[#64748B] line-through">
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
                              className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-[#ECFDF5] hover:bg-emerald-100 text-[#059669] text-xs font-bold inline-flex items-center gap-1"
                            >
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleProductActive(prod)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              {prod.is_active ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-[#64748B]" />
                                  <span>Sembunyikan</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                                  <span>Tampilkan</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-[#EF4444]"
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
        {/* TAB 2: PELAYANAN AKUN PREMIUM / LANGGANAN (KODE 4 ANGKA) */}
        {/* ================================================================== */}
        {activeTab === 'subscriptions' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-[#0F172A]">
                Pelayanan Akun Premium / Produk Langganan ({subscriptions.length})
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Kelola antrian Kode 4 Angka pelanggan: konfirmasi stok tersedia, kirimkan detail akun setelah dibayar, atau batalkan pesanan. Setiap aksi otomatis mengirim email ke pelanggan.
              </p>
            </div>

            {subscriptions.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-12">
                Belum ada antrian produk langganan.
              </p>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => {
                  const isBusy = updatingSubId === sub.id;
                  const noteValue =
                    subNotesDraft[sub.id] !== undefined
                      ? subNotesDraft[sub.id]
                      : sub.admin_note;
                  const accountValue =
                    subAccountDraft[sub.id] !== undefined
                      ? subAccountDraft[sub.id]
                      : sub.delivered_account;

                  const cleanWa = sub.customer_contact.replace(/[^0-9]/g, '');
                  const waLink = cleanWa
                    ? `https://wa.me/${
                        cleanWa.startsWith('0')
                          ? '62' + cleanWa.slice(1)
                          : cleanWa
                      }`
                    : null;

                  const subStatusBadgeClass =
                    sub.status === 'MENUNGGU_ADMIN'
                      ? 'px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800'
                      : sub.status === 'STOK_TERSEDIA'
                      ? 'px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800'
                      : sub.status === 'DIPROSES'
                      ? 'px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#ECFDF5] text-[#059669]'
                      : 'px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-100 text-[#EF4444]';

                  return (
                    <div
                      key={sub.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-3.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-extrabold text-sm tracking-widest">
                            #{sub.code}
                          </span>
                          <span className="font-extrabold text-sm sm:text-base text-[#0F172A]">
                            {sub.product_title}
                          </span>
                          <span className="text-xs font-extrabold text-[#10B981]">
                            (Rp{sub.product_price.toLocaleString('id-ID')})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={subStatusBadgeClass}>
                            {sub.status} ({sub.payment_status})
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteSubscriptionOrder(sub.id)
                            }
                            className="p-1.5 rounded-lg bg-red-50 text-[#EF4444] hover:bg-red-100"
                            title="Hapus Antrian"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-[#0F172A] space-y-1 break-all">
                        <p>
                          <strong>Pelanggan:</strong> {sub.customer_name} •{' '}
                          <strong>Email:</strong> {sub.customer_email}
                          {sub.customer_contact &&
                            ` • WA: ${sub.customer_contact}`}
                        </p>
                        <p className="text-[#64748B]">
                          Dibuat:{' '}
                          {new Date(sub.created_at).toLocaleString('id-ID')} •
                          Batas Tunggu 2 Jam:{' '}
                          {new Date(sub.expires_wait_at).toLocaleTimeString(
                            'id-ID',
                            { hour: '2-digit', minute: '2-digit' }
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#0F172A] mb-1">
                            Keterangan untuk Pelanggan:
                          </label>
                          <textarea
                            rows={2}
                            value={noteValue}
                            onChange={(e) =>
                              setSubNotesDraft((prev) => ({
                                ...prev,
                                [sub.id]: e.target.value,
                              }))
                            }
                            placeholder="Tulis keterangan status stok atau estimasi waktu..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#059669] mb-1">
                            Detail Akun / Produk yang Dikirim (Email/Pass/Link):
                          </label>
                          <textarea
                            rows={2}
                            value={accountValue}
                            onChange={(e) =>
                              setSubAccountDraft((prev) => ({
                                ...prev,
                                [sub.id]: e.target.value,
                              }))
                            }
                            placeholder="Masukkan email & password akun premium atau link akses di sini..."
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleUpdateSubscriptionStatus({
                              sub,
                              nextStatus: 'STOK_TERSEDIA',
                              defaultNote:
                                'Stok tersedia! Silakan lanjutkan pembayaran via QRIS pada halaman Cek Kode 4 Angka.',
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                        >
                          1. Konfirmasi Stok Tersedia (Buka QRIS)
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleUpdateSubscriptionStatus({
                              sub,
                              nextStatus: 'DIPROSES',
                              defaultNote:
                                'Pesanan diproses (tidak dapat dibatalkan). Detail akun telah dikirimkan.',
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold"
                        >
                          2. Pesanan Diproses &amp; Kirim Akun
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleUpdateSubscriptionStatus({
                              sub,
                              nextStatus: 'DIBATALKAN',
                              defaultNote:
                                'Mohon maaf, pesanan dibatalkan karena stok sedang habis / Admin belum dapat melayani.',
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                          3. Batalkan Pesanan
                        </button>

                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0F172A] text-xs font-bold"
                          >
                            Chat WA Pembeli
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PESAN & KLAIM */}
        {activeTab === 'messages' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
            <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
              Kotak Masuk Pesan, Klaim Garansi &amp; Layanan Kustom ({supportMessages.length})
            </h2>
            <p className="text-xs text-[#64748B] mb-5">
              Seluruh pengaduan garansi dan pesanan jasa kustom dari Canvas di halaman toko masuk ke sini.
            </p>

            {supportMessages.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-12">
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
                          ? 'p-4 rounded-xl border min-w-0 bg-[#ECFDF5]/40 border-emerald-300'
                          : 'p-4 rounded-xl border min-w-0 bg-[#F8FAFC] border-slate-200/80'
                      }
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#ECFDF5] text-[#059669] border border-emerald-200">
                            {msg.type === 'KLAIM_GARANSI'
                              ? '🛡️ Klaim Garansi'
                              : msg.type === 'LAYANAN_KHUSUS'
                              ? '✨ Pesan Jasa Kustom'
                              : '💬 Pertanyaan'}
                          </span>
                          <span className="font-extrabold text-sm text-[#0F172A]">
                            {msg.sender_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleMessageStatus(msg)}
                            className={
                              msg.status === 'BARU'
                                ? 'px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 bg-[#10B981] text-white'
                                : 'px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 bg-white border border-slate-200 text-[#64748B]'
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
                            className="p-1.5 rounded-lg bg-red-50 text-[#EF4444]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#0F172A] mb-2 break-all">
                        <strong>Email:</strong> {msg.sender_email}
                        {msg.sender_contact && ` • WA: ${msg.sender_contact}`}
                        {msg.invoice_number &&
                          ` • Invoice: #${msg.invoice_number}`}
                      </p>

                      <div className="p-3 rounded-lg bg-white border border-slate-200/80 text-xs sm:text-sm text-[#0F172A] whitespace-pre-line break-words mb-3">
                        {msg.message}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#10B981] text-white text-xs font-bold"
                          >
                            Balas via WhatsApp
                          </a>
                        )}
                        <a
                          href={`mailto:${msg.sender_email}?subject=Balasan%20Admin%20RizzFlow`}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0F172A] text-xs font-bold"
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

        {/* TAB 4: KATEGORI */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-4">
                Tambah Kategori Produk
              </h2>
              <form onSubmit={handleCreateCategory} className="flex gap-3">
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Contoh: Akun Premium / E-Book"
                  className="flex-1 min-w-0 px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                />
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-5 py-2.5 rounded-xl bg-[#10B981] text-white font-bold text-sm inline-flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h3 className="text-base font-extrabold text-[#0F172A] mb-4">
                Daftar Kategori ({categories.length})
              </h3>
              <div className="space-y-2.5">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80"
                  >
                    <span className="font-bold text-sm text-[#0F172A]">
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 rounded-lg text-[#EF4444] hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: KODE PROMO */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-4">
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
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm uppercase font-bold"
                  />
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={promoPercent}
                    onChange={(e) => setPromoPercent(e.target.value)}
                    placeholder="Diskon (%)"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    required
                    min="0"
                    value={promoMaxRp}
                    onChange={(e) => setPromoMaxRp(e.target.value)}
                    placeholder="Maks Potongan (Rp)"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="datetime-local"
                    required
                    value={promoStartsAt}
                    onChange={(e) => setPromoStartsAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={promoExpiresAt}
                    onChange={(e) => setPromoExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPromo}
                  className="px-5 py-3 rounded-xl bg-[#10B981] text-white font-bold text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan Kode Promo</span>
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h3 className="text-base font-extrabold text-[#0F172A] mb-4">
                Daftar Kode Promo ({promos.length})
              </h3>
              <div className="space-y-3">
                {promos.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/80"
                  >
                    <div>
                      <span className="px-3 py-1 rounded-lg bg-[#ECFDF5] text-[#059669] font-extrabold text-sm border border-emerald-200 mr-2">
                        {p.code}
                      </span>
                      <span className="font-bold text-sm text-[#0F172A]">
                        Diskon {p.discount_percent}% (Maks Rp
                        {p.max_discount_amount.toLocaleString('id-ID')})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white"
                      >
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(p.id)}
                        className="p-2 rounded-lg bg-red-50 text-[#EF4444]"
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

        {/* TAB 6: RIWAYAT PEMBELIAN */}
        {activeTab === 'orders' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
            <h2 className="text-lg font-extrabold text-[#0F172A] mb-4">
              Riwayat Pembelian Pelanggan ({orders.length})
            </h2>
            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-[#0F172A]">
                        #{ord.invoice_number}
                      </span>
                      <span
                        className={
                          ord.payment_status === 'PAID'
                            ? 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669]'
                            : 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700'
                        }
                      >
                        {ord.payment_status}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0F172A] break-all">
                      Email:{' '}
                      <span className="text-[#059669]">
                        {ord.customer_email}
                      </span>
                    </p>
                    <div className="text-sm font-extrabold text-[#0F172A]">
                      Total: Rp{ord.final_amount.toLocaleString('id-ID')}
                    </div>
                  </div>

                  {ord.payment_status === 'PAID' && (
                    <button
                      type="button"
                      onClick={() => handleResendDownloadEmail(ord.id)}
                      disabled={resendingOrderId === ord.id}
                      className="px-3.5 py-2 rounded-xl bg-[#10B981] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
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
          </div>
        )}

        {/* TAB 7: PENGATURAN TOKO & LAYANAN KUSTOM */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#10B981]" />
                <h2 className="text-lg font-extrabold text-[#0F172A]">
                  Pengaturan Layanan Kustom &amp; Kontak Cepat Langganan
                </h2>
              </div>
              <p className="text-xs text-[#64748B] mb-5">
                Atur judul, deskripsi, daftar layanan kustom, serta nomor WhatsApp dan username Telegram Admin untuk respon cepat produk langganan.
              </p>

              <form
                onSubmit={handleSaveCustomServiceConfig}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Nomor WhatsApp Admin (Untuk Tombol Chat Cepat)
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
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0F172A]">
                      Daftar Layanan yang Tersedia *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddServiceItem}
                      className="px-3 py-1 rounded-lg bg-[#ECFDF5] text-[#059669] text-xs font-bold inline-flex items-center gap-1"
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
                        className="flex-1 px-3.5 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                      {customService.services.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceItem(idx)}
                          className="p-2 rounded-lg bg-red-50 text-[#EF4444]"
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
                  className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm"
                >
                  {isSavingCustomService
                    ? 'Menyimpan...'
                    : 'Simpan Pengaturan Layanan Kustom'}
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
                Pengaturan Identitas Toko
              </h2>
              <form onSubmit={handleSaveSettings} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Nama Toko
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.store_name}
                    onChange={(e) =>
                      setSettings({ ...settings, store_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
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
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm"
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