'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  CustomerSupportMessage,
  CustomServiceConfig,
  CustomProjectOrder,
  DEFAULT_CUSTOM_SERVICE_CONFIG,
} from '@/lib/supabase';
import {
  LayoutDashboard,
  Package,
  TicketPercent,
  Settings,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Inbox,
  Menu,
  X,
} from 'lucide-react';
import {
  Category,
  Product,
  PromoCode,
  Order,
  StoreSettings,
} from '@/types';
import {
  AdminTab,
  ServicesSubTab,
  ADMIN_LOGO_PATH,
  FeedbackBanner,
} from '@/components/admin/AdminTypes';
import AdminDashboardTab from '@/components/admin/AdminDashboardTab';
import AdminCatalogTab from '@/components/admin/AdminCatalogTab';
import AdminServicesTab from '@/components/admin/AdminServicesTab';
import AdminPromosSettingsTab from '@/components/admin/AdminPromosSettingsTab';

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
type NullableString = string | null;

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
  const [servicesSubTab, setServicesSubTab] = useState(
    'CUSTOM_ORDERS' as ServicesSubTab
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [feedback, setFeedback] = useState(null as NullableFeedback);

  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(
    null as NullablePwaEvent
  );
  const [notifPermission, setNotifPermission] = useState('default');
  const prevCountsRef = useRef(null as NullablePendingCounts);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Abaikan
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
        icon: ADMIN_LOGO_PATH,
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
        'Untuk memasang aplikasi di HP: Klik menu titik tiga di pojok kanan atas browser Chrome/Safari, lalu pilih "Tambahkan ke Layar Utama".'
      );
    }
  };

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
      if (catRes.data) setCategories(catRes.data as Category[]);
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
                  icon: ADMIN_LOGO_PATH,
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
    [accessToken]
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
    src={ADMIN_LOGO_PATH}
    alt="Logo"
    className="h-9 w-9 object-contain shrink-0"
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
                    src={ADMIN_LOGO_PATH}
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
                src={ADMIN_LOGO_PATH}
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

      {/* AREA KONTEN UTAMA 5 HALAMAN MODULAR ADMIN */}
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

        {activeTab === 'dashboard' && (
          <AdminDashboardTab
            orders={orders}
            products={products}
            categories={categories}
            supportMessages={supportMessages}
            customOrders={customOrders}
            notifPermission={notifPermission}
            resendingOrderId={resendingOrderId}
            onEnableNotifications={handleEnableBrowserNotifications}
            onInstallPwa={handleInstallPwaApp}
            onResendEmail={handleResendDownloadEmail}
            onSelectTab={selectTab}
            onOpenServicesSubTab={setServicesSubTab}
          />
        )}

        {activeTab === 'catalog' && (
          <AdminCatalogTab
            products={products}
            categories={categories}
            onRefreshData={() => fetchAllAdminData()}
            onShowFeedback={showMessage}
          />
        )}

        {activeTab === 'services' && (
          <AdminServicesTab
            accessToken={accessToken}
            customOrders={customOrders}
            supportMessages={supportMessages}
            servicesSubTab={servicesSubTab}
            onChangeSubTab={setServicesSubTab}
            onUpdateCustomOrders={setCustomOrders}
            onUpdateMessages={setSupportMessages}
            onShowFeedback={showMessage}
          />
        )}

        {(activeTab === 'promos' || activeTab === 'settings') && (
          <AdminPromosSettingsTab
            mode={activeTab}
            accessToken={accessToken}
            promos={promos}
            settings={settings}
            customService={customService}
            onChangeSettings={setSettings}
            onChangeCustomService={setCustomService}
            onRefreshData={() => fetchAllAdminData()}
            onShowFeedback={showMessage}
          />
        )}
      </main>
    </div>
  );
}