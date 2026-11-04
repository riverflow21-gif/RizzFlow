'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import {
  Category,
  Product,
  PromoCode,
  Order,
  StoreSettings,
} from '@/types';

type AdminTab =
  | 'orders'
  | 'products'
  | 'categories'
  | 'promos'
  | 'messages'
  | 'settings';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // State Data Utama
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supportMessages, setSupportMessages] = useState<CustomerSupportMessage[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    id: 1,
    store_name: 'RizzFlow',
    banner_description: '',
    support_contact: '',
    updated_at: '',
  });
  const [customService, setCustomService] = useState<CustomServiceConfig>(
    DEFAULT_CUSTOM_SERVICE_CONFIG
  );

  // State Form Tambah Produk Baru
  const [prodTitle, setProdTitle] = useState<string>('');
  const [prodCategoryId, setProdCategoryId] = useState<string>('');
  const [prodPrice, setProdPrice] = useState<string>('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState<string>('');
  const [prodBadge, setProdBadge] = useState<string>('');
  const [prodDesc, setProdDesc] = useState<string>('');
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [digitalFiles, setDigitalFiles] = useState<File[]>([]);
  const [productLinks, setProductLinks] = useState<string[]>(['']);
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // State Form Tambah Kategori & Promo
  const [catName, setCatName] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoPercent, setPromoPercent] = useState<string>('20');
  const [promoMaxRp, setPromoMaxRp] = useState<string>('15000');
  const [promoStartsAt, setPromoStartsAt] = useState<string>('');
  const [promoExpiresAt, setPromoExpiresAt] = useState<string>('');
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false);

  // State Pengaturan Toko, Layanan Kustom, & Kirim Ulang Email
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isSavingCustomService, setIsSavingCustomService] = useState<boolean>(false);
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/admin/login');
  }, [router]);

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
    async (tokenOverride?: string) => {
      const tokenToUse = tokenOverride || accessToken;
      const [prodRes, catRes, promoRes, orderRes, setRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(*)')
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name', { ascending: true }),
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
          const msgRes = await fetch('/api/messages', {
            headers: { Authorization: `Bearer ${tokenToUse}` },
          });
          if (msgRes.ok) {
            const msgData = (await msgRes.json()) as {
              messages?: CustomerSupportMessage[];
              customServiceConfig?: CustomServiceConfig;
            };
            if (msgData.messages) setSupportMessages(msgData.messages);
            if (msgData.customServiceConfig) {
              setCustomService(msgData.customServiceConfig);
            }
          }
        } catch (e) {
          console.error('Gagal memuat pesan & konfigurasi layanan:', e);
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

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  // ==========================================================================
  // 1. LOGIKA MANAJEMEN PRODUK
  // ==========================================================================
  const handleAddLinkRow = () => setProductLinks((prev) => [...prev, '']);
  const handleUpdateLinkRow = (index: number, value: string) =>
    setProductLinks((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  const handleRemoveLinkRow = (index: number) =>
    setProductLinks((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== index) : ['']
    );

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = productLinks.map((l) => l.trim()).filter((l) => l.length > 0);

    if (thumbnailFiles.length === 0) {
      showMessage('error', 'Harap pilih minimal 1 Gambar Sampul (Thumbnail).');
      return;
    }

    if (digitalFiles.length === 0 && validLinks.length === 0) {
      showMessage(
        'error',
        'Harap unggah minimal 1 File Produk ATAU masukkan minimal 1 Link Produk.'
      );
      return;
    }

    setIsSavingProduct(true);
    try {
      const timestamp = Date.now();
      const uploadedThumbUrls: string[] = [];
      const uploadedFilePaths: string[] = [];

      for (let i = 0; i < thumbnailFiles.length; i++) {
        const file = thumbnailFiles[i];
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const thumbPath = `thumb_${timestamp}_${i}_${cleanName}`;

        const { error: thumbErr } = await supabase.storage
          .from('product-thumbnails')
          .upload(thumbPath, file, { upsert: false });

        if (thumbErr) throw new Error(`Gagal upload gambar: ${thumbErr.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('product-thumbnails')
          .getPublicUrl(thumbPath);

        uploadedThumbUrls.push(publicUrlData.publicUrl);
      }

      for (let j = 0; j < digitalFiles.length; j++) {
        const dFile = digitalFiles[j];
        const cleanName = dFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const digitalPath = `file_${timestamp}_${j}_${cleanName}`;

        const { error: fileErr } = await supabase.storage
          .from('digital-products')
          .upload(digitalPath, dFile, { upsert: false });

        if (fileErr) throw new Error(`Gagal upload file: ${fileErr.message}`);
        uploadedFilePaths.push(digitalPath);
      }

      const thumbnailPayload =
        uploadedThumbUrls.length === 1
          ? uploadedThumbUrls[0]
          : JSON.stringify(uploadedThumbUrls);

      const numericOriginalPrice = prodOriginalPrice
        ? Math.max(0, Number(prodOriginalPrice) || 0)
        : null;

      const deliverablesPayload = JSON.stringify({
        files: uploadedFilePaths,
        links: validLinks,
        original_price: numericOriginalPrice,
      });

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

      setProdTitle('');
      setProdPrice('');
      setProdOriginalPrice('');
      setProdBadge('');
      setProdDesc('');
      setThumbnailFiles([]);
      setDigitalFiles([]);
      setProductLinks(['']);
      setFileInputKey((prev) => prev + 1);

      await fetchAllAdminData();
      showMessage('success', 'Produk baru berhasil disimpan!');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Gagal menambah produk.');
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
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Produk berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 2. LOGIKA KATEGORI, PROMO, & PESAN PELANGGAN
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
      showMessage('error', err instanceof Error ? err.message : 'Gagal membuat kategori.');
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
      showMessage('error', err instanceof Error ? err.message : 'Gagal membuat kode promo.');
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
      const data = (await res.json()) as { messages?: CustomerSupportMessage[] };
      if (data.messages) setSupportMessages(data.messages);
    }
  };

  const handleDeleteSupportMessage = async (id: string) => {
    const res = await fetch(`/api/messages?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { messages?: CustomerSupportMessage[] };
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
      showMessage('error', err instanceof Error ? err.message : 'Gagal kirim email.');
    } finally {
      setResendingOrderId(null);
    }
  };

  // ==========================================================================
  // 3. LOGIKA PENGATURAN TOKO & PENGATURAN LAYANAN KUSTOM
  // ==========================================================================
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
      showMessage('error', err instanceof Error ? err.message : 'Gagal menyimpan.');
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

      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan Layanan Kustom.');
      if (data.customServiceConfig) setCustomService(data.customServiceConfig);
      showMessage('success', data.message || 'Pengaturan Layanan Kustom disimpan!');
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

  // Komponen Daftar Tombol Menu Vertikal (Digunakan di Sidebar Desktop & Side Navbar HP)
  const renderSidebarNavItems = () => (
    <nav className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => selectTab('products')}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'products'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <Package className="w-4 h-4 shrink-0" />
        <span>Produk ({products.length})</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('messages')}
        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'messages'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <div className="flex items-center gap-3">
          <Inbox className="w-4 h-4 shrink-0" />
          <span>Pesan & Klaim</span>
        </div>
        {unreadMessagesCount > 0 && (
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
              activeTab === 'messages'
                ? 'bg-white text-[#059669]'
                : 'bg-rose-500 text-white'
            }`}
          >
            {unreadMessagesCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => selectTab('orders')}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'orders'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <ShoppingBag className="w-4 h-4 shrink-0" />
        <span>Riwayat Pembelian ({orders.length})</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('categories')}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'categories'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <FolderTree className="w-4 h-4 shrink-0" />
        <span>Kategori ({categories.length})</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('promos')}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'promos'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <TicketPercent className="w-4 h-4 shrink-0" />
        <span>Kode Promo ({promos.length})</span>
      </button>

      <button
        type="button"
        onClick={() => selectTab('settings')}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
          activeTab === 'settings'
            ? 'bg-[#10B981] text-white shadow-xs'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
        }`}
      >
        <Settings className="w-4 h-4 shrink-0" />
        <span>Pengaturan & Kustom</span>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row overflow-x-hidden">
      {/* ==================================================================== */}
      {/* HEADER ATAS KHUSUS HP (DENGAN TOMBOL BUKA SIDE NAVBAR DI SAMPING) */}
      {/* ==================================================================== */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#0F172A] border border-slate-200 relative"
            aria-label="Buka Menu Samping"
          >
            <Menu className="w-5 h-5 text-[#10B981]" />
            {unreadMessagesCount > 0 && (
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

      {/* ==================================================================== */}
      {/* SIDE NAVBAR DRAWER DI SAMPING KIRI (UNTUK LAYAR HP) */}
      {/* ==================================================================== */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs md:hidden flex"
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

      {/* ==================================================================== */}
      {/* SIDEBAR NAVBAR TETAP DI SAMPING KIRI (UNTUK LAYAR DESKTOP/LAPTOP) */}
      {/* ==================================================================== */}
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
              Pesanan Lunas
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F172A] mt-1">
              {orders.filter((o) => o.payment_status === 'PAID').length} Transaksi
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 col-span-2 sm:col-span-1 min-w-0">
            <span className="text-xs text-[#64748B] font-semibold">
              Pesan & Klaim Masuk
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F172A] mt-1">
              {unreadMessagesCount} Belum Dibaca
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 break-words ${
              feedback.type === 'success'
                ? 'bg-[#ECFDF5] border-emerald-200 text-[#059669]'
                : 'bg-red-50 border-red-200 text-[#EF4444]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.message}</span>
          </div>
        )}

        {/* TAB 1: MANAJEMEN PRODUK DIGITAL */}
        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
                Tambah Produk Digital Baru
              </h2>
              <p className="text-xs text-[#64748B] mb-5">
                Dilengkapi fitur Harga Coret, multi-gambar sampul, multi-file, dan link Google Drive.
              </p>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Nama Produk Digital *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodTitle}
                      onChange={(e) => setProdTitle(e.target.value)}
                      placeholder="Contoh: Paket E-Book & Template Bisnis"
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
                    placeholder="Contoh: Terlaris / Baru"
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
                    placeholder="Jelaskan isi produk, keunggulan, dan apa saja yang didapat pembeli..."
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-slate-300 min-w-0">
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      1. Pilih Gambar Sampul / Thumbnail (Bisa lebih dari 1) *
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
                        ✓ {thumbnailFiles.length} gambar dipilih
                      </p>
                    )}
                  </div>

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
                        ✓ {digitalFiles.length} file dipilih
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A]">
                        2B. Link Produk Eksternal / Google Drive (Opsional)
                      </label>
                    </div>
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
                          onChange={(e) => handleUpdateLinkRow(idx, e.target.value)}
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

                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors"
                >
                  {isSavingProduct ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunggah & Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Simpan & Terbitkan Produk</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h3 className="text-base font-extrabold text-[#0F172A] mb-4">
                Daftar Katalog Produk ({products.length})
              </h3>
              {products.length === 0 ? (
                <p className="text-sm text-[#64748B] py-6 text-center">
                  Belum ada produk.
                </p>
              ) : (
                <div className="space-y-3">
                  {products.map((prod) => {
                    const thumbs = parseThumbnails(prod.thumbnail_url);
                    const deliverables = parseProductDeliverables(prod.file_path);

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
                                    Rp{deliverables.original_price.toLocaleString('id-ID')}
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
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

        {/* TAB PESAN & KLAIM */}
        {activeTab === 'messages' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
            <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
              Kotak Masuk Pesan, Klaim Garansi & Layanan Kustom ({supportMessages.length})
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
                        cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa
                      }`
                    : null;

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl border min-w-0 ${
                        msg.status === 'BARU'
                          ? 'bg-[#ECFDF5]/40 border-emerald-300'
                          : 'bg-[#F8FAFC] border-slate-200/80'
                      }`}
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
                            className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                              msg.status === 'BARU'
                                ? 'bg-[#10B981] text-white'
                                : 'bg-white border border-slate-200 text-[#64748B]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {msg.status === 'BARU' ? 'Tandai Selesai' : 'Selesai'}
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
                        {msg.invoice_number && ` • Invoice: #${msg.invoice_number}`}
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

        {/* TAB KATEGORI */}
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
                  placeholder="Contoh: E-Book / Template Notion"
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

        {/* TAB KODE PROMO */}
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

        {/* TAB RIWAYAT PEMBELIAN */}
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
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          ord.payment_status === 'PAID'
                            ? 'bg-[#ECFDF5] text-[#059669]'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {ord.payment_status}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0F172A] break-all">
                      Email: <span className="text-[#059669]">{ord.customer_email}</span>
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

        {/* ================================================================== */}
        {/* TAB PENGATURAN TOKO & PENGATURAN LAYANAN KUSTOM */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            {/* Form 1: Pengaturan Layanan Kustom (Judul, Deskripsi, & Daftar Layanan) */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#10B981]" />
                <h2 className="text-lg font-extrabold text-[#0F172A]">
                  Pengaturan Seksi Layanan Kustom
                </h2>
              </div>
              <p className="text-xs text-[#64748B] mb-5">
                Atur judul, penjelasan singkat, dan daftar layanan kustom yang ditampilkan di halaman toko.
              </p>

              <form onSubmit={handleSaveCustomServiceConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Judul Layanan Kustom *
                  </label>
                  <input
                    type="text"
                    required
                    value={customService.title}
                    onChange={(e) =>
                      setCustomService({ ...customService, title: e.target.value })
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

            {/* Form 2: Pengaturan Identitas Toko Dasar */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
                Pengaturan Identitas Toko
              </h2>
              <p className="text-xs text-[#64748B] mb-5">
                Ubah nama toko, kalimat sambutan di banner halaman depan, serta kontak bantuan pelanggan.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-4">
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
                  {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Toko'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}