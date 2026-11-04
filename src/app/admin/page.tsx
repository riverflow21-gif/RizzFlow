'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
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
} from 'lucide-react';
import {
  Category,
  Product,
  PromoCode,
  Order,
  StoreSettings,
} from '@/types';

type AdminTab = 'orders' | 'products' | 'categories' | 'promos' | 'settings';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
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
  const [settings, setSettings] = useState<StoreSettings>({
    id: 1,
    store_name: 'RizzFlow',
    banner_description: '',
    support_contact: '',
    updated_at: '',
  });

  // State Form Tambah Produk Baru (Mendukung Banyak Gambar, Banyak File, & Link Google Drive)
  const [prodTitle, setProdTitle] = useState<string>('');
  const [prodCategoryId, setProdCategoryId] = useState<string>('');
  const [prodPrice, setProdPrice] = useState<string>('');
  const [prodBadge, setProdBadge] = useState<string>('');
  const [prodDesc, setProdDesc] = useState<string>('');
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [digitalFiles, setDigitalFiles] = useState<File[]>([]);
  const [productLinks, setProductLinks] = useState<string[]>(['']);
  // Key khusus untuk me-reset input file sampai bersih setelah produk disimpan
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // State Form Tambah Kategori Baru
  const [catName, setCatName] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  // State Form Tambah Kode Promo Detail
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoPercent, setPromoPercent] = useState<string>('20');
  const [promoMaxRp, setPromoMaxRp] = useState<string>('15000');
  const [promoStartsAt, setPromoStartsAt] = useState<string>('');
  const [promoExpiresAt, setPromoExpiresAt] = useState<string>('');
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false);

  // State Pengaturan Toko & Kirim Ulang Email
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Fungsi Logout Penuh (Memutus sesi di semua perangkat & mewajibkan password saat masuk lagi)
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/admin/login');
  }, [router]);

  // Auto-Logout otomatis jika halaman Admin didiamkan tanpa aktivitas selama 30 menit
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, 30 * 60 * 1000); // 30 Menit
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

  const fetchAllAdminData = useCallback(async () => {
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
  }, [prodCategoryId]);

  useEffect(() => {
    const verifyAdmin = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/admin/login');
        return;
      }
      setAccessToken(data.session.access_token);
      setAdminEmail(data.session.user.email || 'Admin');

      const now = new Date();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setPromoStartsAt(now.toISOString().slice(0, 16));
      setPromoExpiresAt(nextWeek.toISOString().slice(0, 16));

      await fetchAllAdminData();
      setIsLoadingInitial(false);
    };

    verifyAdmin();
  }, [router, fetchAllAdminData]);

  // ==========================================================================
  // 1. LOGIKA MANAJEMEN PRODUK (MULTI THUMBNAIL, MULTI FILE, & LINK DRIVE)
  // ==========================================================================
  const handleAddLinkRow = () => {
    setProductLinks((prev) => [...prev, '']);
  };

  const handleUpdateLinkRow = (index: number, value: string) => {
    setProductLinks((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleRemoveLinkRow = (index: number) => {
    setProductLinks((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== index) : ['']
    );
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLinks = productLinks
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (thumbnailFiles.length === 0) {
      showMessage('error', 'Harap pilih minimal 1 Gambar Sampul (Thumbnail).');
      return;
    }

    if (digitalFiles.length === 0 && validLinks.length === 0) {
      showMessage(
        'error',
        'Harap unggah minimal 1 File Produk ATAU masukkan minimal 1 Link Produk (seperti Google Drive).'
      );
      return;
    }

    setIsSavingProduct(true);
    try {
      const timestamp = Date.now();
      const uploadedThumbUrls: string[] = [];
      const uploadedFilePaths: string[] = [];

      // A. Unggah Semua Gambar Sampul ke Public Bucket 'product-thumbnails'
      for (let i = 0; i < thumbnailFiles.length; i++) {
        const file = thumbnailFiles[i];
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const thumbPath = `thumb_${timestamp}_${i}_${cleanName}`;

        const { error: thumbErr } = await supabase.storage
          .from('product-thumbnails')
          .upload(thumbPath, file, { upsert: false });

        if (thumbErr) {
          throw new Error(`Gagal mengunggah gambar ${file.name}: ${thumbErr.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-thumbnails')
          .getPublicUrl(thumbPath);

        uploadedThumbUrls.push(publicUrlData.publicUrl);
      }

      // B. Unggah Semua File Produk (Jika Ada) ke Private Bucket 'digital-products'
      for (let j = 0; j < digitalFiles.length; j++) {
        const dFile = digitalFiles[j];
        const cleanName = dFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const digitalPath = `file_${timestamp}_${j}_${cleanName}`;

        const { error: fileErr } = await supabase.storage
          .from('digital-products')
          .upload(digitalPath, dFile, { upsert: false });

        if (fileErr) {
          throw new Error(`Gagal mengunggah file ${dFile.name}: ${fileErr.message}`);
        }

        uploadedFilePaths.push(digitalPath);
      }

      // C. Simpan URL Thumbnail (Jika 1 gambar simpan biasa, jika >1 simpan JSON array)
      const thumbnailPayload =
        uploadedThumbUrls.length === 1
          ? uploadedThumbUrls[0]
          : JSON.stringify(uploadedThumbUrls);

      // D. Simpan File & Link Eksternal dalam format JSON terstruktur
      const deliverablesPayload = JSON.stringify({
        files: uploadedFilePaths,
        links: validLinks,
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

      if (insertErr) {
        throw new Error(`Gagal menyimpan data produk: ${insertErr.message}`);
      }

      // Reset seluruh form termasuk mengosongkan input file (fileInputKey + 1)
      setProdTitle('');
      setProdPrice('');
      setProdBadge('');
      setProdDesc('');
      setThumbnailFiles([]);
      setDigitalFiles([]);
      setProductLinks(['']);
      setFileInputKey((prev) => prev + 1);

      await fetchAllAdminData();
      showMessage('success', 'Produk baru berhasil disimpan dan langsung tampil di toko!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menambahkan produk.'
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

    if (error) {
      showMessage('error', `Gagal mengubah status produk: ${error.message}`);
    } else {
      await fetchAllAdminData();
      showMessage('success', 'Status tampilan produk berhasil diperbarui.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      showMessage('error', `Gagal menghapus produk: ${error.message}`);
    } else {
      await fetchAllAdminData();
      showMessage('success', 'Produk berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 2. LOGIKA MANAJEMEN KATEGORI
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

      const { error } = await supabase.from('categories').insert({
        name: catName.trim(),
        slug,
      });

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
    if (error) {
      showMessage('error', `Gagal menghapus kategori: ${error.message}`);
    } else {
      await fetchAllAdminData();
      showMessage('success', 'Kategori berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 3. LOGIKA MANAJEMEN KODE PROMO DETAIL
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
      showMessage('success', 'Status kode promo berhasil diperbarui.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      await fetchAllAdminData();
      showMessage('success', 'Kode promo berhasil dihapus.');
    }
  };

  // ==========================================================================
  // 4. LOGIKA RIWAYAT TRANSAKSI & KIRIM ULANG EMAIL
  // ==========================================================================
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
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim ulang email.');
      }

      showMessage('success', data.message || 'Email berhasil dikirim ulang!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal mengirim ulang email.'
      );
    } finally {
      setResendingOrderId(null);
    }
  };

  // ==========================================================================
  // 5. LOGIKA PENGATURAN TOKO DASAR
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
      showMessage('success', 'Pengaturan toko berhasil disimpan!');
    } catch (err) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan toko.'
      );
    } finally {
      setIsSavingSettings(false);
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row overflow-x-hidden">
      {/* Sidebar Navigasi Kiri (Desktop) & Header Atas (Mobile) */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 shrink-0 flex flex-col justify-between">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-5">
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

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/"
                className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#ECFDF5] text-[#059669] border border-slate-200"
                title="Lihat Halaman Toko"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>

              {/* Tombol Keluar (Logout) untuk Layar HP agar selalu terlihat jelas */}
              <button
                type="button"
                onClick={handleLogout}
                className="md:hidden px-2.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-[#EF4444] text-xs font-bold inline-flex items-center gap-1"
                title="Keluar (Logout)"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>

          {/* Menu Navigasi Tab Admin */}
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === 'products'
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Produk ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === 'categories'
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <FolderTree className="w-4 h-4 shrink-0" />
              <span>Kategori ({categories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('promos')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === 'promos'
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <TicketPercent className="w-4 h-4 shrink-0" />
              <span>Kode Promo ({promos.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === 'orders'
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Riwayat Pembelian ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Pengaturan Toko</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100 hidden md:block">
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

      {/* Area Konten Utama Admin (Anti Geser Samping di HP dengan min-w-0 & overflow-x-hidden) */}
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
              Produk Aktif di Katalog
            </span>
            <div className="text-lg sm:text-2xl font-extrabold text-[#0F172A] mt-1">
              {products.filter((p) => p.is_active).length} Produk
            </div>
          </div>
        </div>

        {/* Notifikasi Sukses / Error */}
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

        {/* ================================================================== */}
        {/* TAB 1: MANAJEMEN PRODUK DIGITAL */}
        {/* ================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-8">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
                Tambah Produk Digital Baru
              </h2>
              <p className="text-xs text-[#64748B] mb-5">
                Bisa unggah lebih dari 1 gambar sampul, lebih dari 1 file produk, dan/atau menggunakan Link Google Drive.
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
                      Harga (Rupiah) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="Contoh: 49000"
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
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

                {/* Bagian Upload Banyak Thumbnail & Banyak File */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-slate-300 min-w-0">
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      1. Pilih Gambar Sampul / Thumbnail (Bisa lebih dari 1) *
                    </label>
                    <p className="text-[11px] text-[#64748B] mb-2">
                      Pilih 1 atau beberapa gambar sekaligus (.jpg, .png, .webp).
                    </p>
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
                      className="text-xs text-[#0F172A] w-full"
                    />
                    {thumbnailFiles.length > 0 && (
                      <p className="text-[11px] font-bold text-[#059669] mt-2 break-all">
                        ✓ {thumbnailFiles.length} gambar dipilih:{' '}
                        {thumbnailFiles.map((f) => f.name).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-[#ECFDF5]/60 border border-dashed border-emerald-300 min-w-0">
                    <label className="block text-xs font-bold text-[#059669] mb-1">
                      2A. Upload File Produk (Opsional — Bisa lebih dari 1 file)
                    </label>
                    <p className="text-[11px] text-[#64748B] mb-2">
                      Pilih 1 atau beberapa file (.pdf, .xlsx, .pptx, .zip). Boleh dikosongkan jika memakai Link di bawah.
                    </p>
                    <input
                      key={`digital-${fileInputKey}`}
                      type="file"
                      multiple
                      onChange={(e) =>
                        setDigitalFiles(
                          e.target.files ? Array.from(e.target.files) : []
                        )
                      }
                      className="text-xs text-[#0F172A] w-full"
                    />
                    {digitalFiles.length > 0 && (
                      <p className="text-[11px] font-bold text-[#059669] mt-2 break-all">
                        ✓ {digitalFiles.length} file dipilih:{' '}
                        {digitalFiles.map((f) => f.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bagian Input Link Produk (Google Drive, Mega, Notion, dll.) */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A]">
                        2B. Link Produk Eksternal / Google Drive (Opsional — Bisa lebih dari 1 link)
                      </label>
                      <p className="text-[11px] text-[#64748B]">
                        Masukkan link Google Drive, Mega, Canva, atau Notion jika produk berupa link.
                      </p>
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
                          title="Hapus baris link"
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

            {/* Daftar Produk (Anti Melebar di HP dengan min-w-0 & break-all) */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h3 className="text-base font-extrabold text-[#0F172A] mb-4">
                Daftar Katalog Produk ({products.length})
              </h3>
              {products.length === 0 ? (
                <p className="text-sm text-[#64748B] py-6 text-center">
                  Belum ada produk. Silakan unggah produk pertamamu melalui formulir di atas.
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
                              {thumbs.length > 1 && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">
                                  {thumbs.length} Foto
                                </span>
                              )}
                              {!prod.is_active && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                                  Disembunyikan
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-extrabold text-[#10B981] mt-0.5">
                              Rp{prod.price.toLocaleString('id-ID')}
                            </p>

                            <div className="text-[11px] text-[#64748B] mt-1 space-y-0.5 break-all">
                              {deliverables.files.length > 0 && (
                                <p>
                                  File ({deliverables.files.length}):{' '}
                                  {deliverables.files.join(', ')}
                                </p>
                              )}
                              {deliverables.links.length > 0 && (
                                <p className="text-[#059669] font-medium">
                                  Link ({deliverables.links.length}):{' '}
                                  {deliverables.links.join(', ')}
                                </p>
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
        {/* TAB 2: MANAJEMEN KATEGORI */}
        {/* ================================================================== */}
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
                  className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm inline-flex items-center gap-1.5 shrink-0"
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
                    className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 min-w-0"
                  >
                    <div className="min-w-0 break-words">
                      <span className="font-bold text-sm text-[#0F172A]">
                        {cat.name}
                      </span>
                      <span className="ml-2 text-xs text-[#64748B]">
                        ({cat.slug})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 rounded-lg text-[#EF4444] hover:bg-red-50 shrink-0"
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
        {/* TAB 3: MANAJEMEN KODE PROMO DETAIL */}
        {/* ================================================================== */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-[#0F172A] mb-1">
                Buat Kode Promo Baru
              </h2>
              <p className="text-xs text-[#64748B] mb-5">
                Atur kode unik, besaran diskon (%), batas maksimal potongan dalam Rupiah, serta masa berlaku promo.
              </p>

              <form onSubmit={handleCreatePromo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Kode Promo Unik *
                    </label>
                    <input
                      type="text"
                      required
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Contoh: HEMAT20"
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Persentase Diskon (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={promoPercent}
                      onChange={(e) => setPromoPercent(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Maksimal Potongan (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={promoMaxRp}
                      onChange={(e) => setPromoMaxRp(e.target.value)}
                      placeholder="Contoh: 15000"
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Waktu Mulai Berlaku *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={promoStartsAt}
                      onChange={(e) => setPromoStartsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      Waktu Berakhir (Kedaluwarsa) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={promoExpiresAt}
                      onChange={(e) => setPromoExpiresAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingPromo}
                  className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm inline-flex items-center gap-2"
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
              {promos.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-6">
                  Belum ada kode promo yang dibuat.
                </p>
              ) : (
                <div className="space-y-3">
                  {promos.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/80 min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 rounded-lg bg-[#ECFDF5] text-[#059669] font-extrabold text-sm border border-emerald-200">
                            {p.code}
                          </span>
                          <span className="font-bold text-sm text-[#0F172A]">
                            Diskon {p.discount_percent}% (Maks Rp
                            {p.max_discount_amount.toLocaleString('id-ID')})
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] mt-1.5">
                          Berlaku: {new Date(p.starts_at).toLocaleString('id-ID')} s/d{' '}
                          {new Date(p.expires_at).toLocaleString('id-ID')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePromo(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            p.is_active
                              ? 'bg-white text-[#0F172A] border-slate-200'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}
                        >
                          {p.is_active ? 'Aktif (Klik untuk Matikan)' : 'Nonaktif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePromo(p.id)}
                          className="p-2 rounded-lg bg-red-50 text-[#EF4444] hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: RIWAYAT PEMBELIAN & TRANSAKSI PELANGGAN */}
        {/* ================================================================== */}
        {activeTab === 'orders' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
            <h2 className="text-lg font-extrabold text-[#0F172A] mb-4">
              Riwayat Pembelian Pelanggan ({orders.length})
            </h2>

            {orders.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-10">
                Belum ada riwayat transaksi pembelian.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#0F172A]">
                          #{ord.invoice_number}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            ord.payment_status === 'PAID'
                              ? 'bg-[#ECFDF5] text-[#059669] border border-emerald-200'
                              : ord.payment_status === 'EXPIRED'
                              ? 'bg-red-50 text-[#EF4444] border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ord.payment_status}
                        </span>
                        <span className="text-xs text-[#64748B]">
                          {new Date(ord.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#0F172A] break-all">
                        Email Pembeli:{' '}
                        <span className="text-[#059669]">{ord.customer_email}</span>
                      </p>

                      {ord.order_items && ord.order_items.length > 0 && (
                        <p className="text-xs text-[#64748B] break-words">
                          Produk:{' '}
                          {ord.order_items
                            .map((i) => `${i.product_title} (x${i.quantity})`)
                            .join(', ')}
                        </p>
                      )}

                      <div className="text-sm font-extrabold text-[#0F172A] pt-1">
                        Total Bayar: Rp{ord.final_amount.toLocaleString('id-ID')}
                        {ord.promo_code_used && (
                          <span className="ml-2 text-xs font-semibold text-[#059669]">
                            (Promo: {ord.promo_code_used})
                          </span>
                        )}
                      </div>
                    </div>

                    {ord.payment_status === 'PAID' && (
                      <button
                        type="button"
                        onClick={() => handleResendDownloadEmail(ord.id)}
                        disabled={resendingOrderId === ord.id}
                        className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-center shrink-0"
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
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: PENGATURAN TOKO DASAR */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
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
        )}
      </main>
    </div>
  );
}