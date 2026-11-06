'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Mail,
  BellRing,
  MessageCircle,
  Store,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
  Lock,
} from 'lucide-react';
import { supabase, CustomServiceConfig } from '@/lib/supabase';
import { PromoCode, StoreSettings } from '@/types';

interface AdminPromosSettingsTabProps {
  mode: 'promos' | 'settings';
  accessToken: string;
  promos: PromoCode[];
  settings: StoreSettings;
  customService: CustomServiceConfig;
  onChangeSettings: (next: StoreSettings) => void;
  onChangeCustomService: (next: CustomServiceConfig) => void;
  onRefreshData: () => Promise<void>;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
}

type ActiveSettingModalType =
  | 'NONE'
  | 'GMAIL'
  | 'TELEGRAM_BOT'
  | 'ADMIN_CONTACT'
  | 'CUSTOM_SERVICES'
  | 'STORE_IDENTITY';

export default function AdminPromosSettingsTab({
  mode,
  accessToken,
  promos,
  settings,
  customService,
  onChangeSettings,
  onChangeCustomService,
  onRefreshData,
  onShowFeedback,
}: AdminPromosSettingsTabProps) {
  // State Kode Promo
  const [promoCode, setPromoCode] = useState('');
  const [promoPercent, setPromoPercent] = useState('20');
  const [promoMaxRp, setPromoMaxRp] = useState('15000');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoExpiresAt, setPromoExpiresAt] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  // State Modal Pengaturan Tertutup (Buka -> Edit -> Save -> Tutup Otomatis)
  const [activeSettingModal, setActiveSettingModal] = useState(
    'NONE' as ActiveSettingModalType
  );
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [isSavingModal, setIsSavingModal] = useState(false);

  useEffect(() => {
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setPromoStartsAt(now.toISOString().slice(0, 16));
    setPromoExpiresAt(nextWeek.toISOString().slice(0, 16));
  }, []);

  const openSettingCategory = (category: ActiveSettingModalType) => {
    setActiveSettingModal(category);
    setIsEditUnlocked(false); // Terkunci (Mode Lihat) sampai tombol Edit diklik
  };

  const closeSettingModal = () => {
    if (isSavingModal) return;
    setActiveSettingModal('NONE');
    setIsEditUnlocked(false);
  };

  // ==========================================================================
  // LOGIKA KODE PROMO
  // ==========================================================================
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPromo(true);
    try {
      const cleanCode = promoCode.trim().toUpperCase().split(' ').join('');
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
      await onRefreshData();
      onShowFeedback('success', `Kode promo ${cleanCode} berhasil dibuat!`);
    } catch (err) {
      onShowFeedback(
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
      await onRefreshData();
      onShowFeedback('success', 'Status kode promo diperbarui.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      await onRefreshData();
      onShowFeedback('success', 'Kode promo dihapus.');
    }
  };

  // ==========================================================================
  // LOGIKA SIMPAN PENGATURAN & TUTUP OTOMATIS
  // ==========================================================================
  const handleSaveCustomConfigAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditUnlocked) return;

    setIsSavingModal(true);
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
      if (data.customServiceConfig) {
        onChangeCustomService(data.customServiceConfig);
      }
      onShowFeedback('success', 'Perubahan berhasil disimpan!');
      // Langsung tutup otomatis setelah berhasil di-Save
      setActiveSettingModal('NONE');
      setIsEditUnlocked(false);
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleSaveStoreIdentityAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditUnlocked) return;

    setIsSavingModal(true);
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
      onShowFeedback('success', 'Identitas toko berhasil disimpan!');
      // Langsung tutup otomatis setelah berhasil di-Save
      setActiveSettingModal('NONE');
      setIsEditUnlocked(false);
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan identitas toko.'
      );
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleAddServiceItem = () => {
    onChangeCustomService({
      ...customService,
      services: [...customService.services, ''],
    });
  };

  const handleUpdateServiceItem = (index: number, value: string) => {
    onChangeCustomService({
      ...customService,
      services: customService.services.map((s, idx) =>
        idx === index ? value : s
      ),
    });
  };

  const handleRemoveServiceItem = (index: number) => {
    onChangeCustomService({
      ...customService,
      services:
        customService.services.length > 1
          ? customService.services.filter((_, idx) => idx !== index)
          : [''],
    });
  };

  // ==========================================================================
  // TAMPILAN HALAMAN 4: KODE PROMO
  // ==========================================================================
  if (mode === 'promos') {
    return (
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
          {promos.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#6B9071] text-center py-8">
              Belum ada kode promo aktif.
            </p>
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // TAMPILAN HALAMAN 5: MENU TOMBOL PENGATURAN TERTUTUP (KLIK UNTUK MEMBUKA)
  // ==========================================================================
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A1D]">
          Pusat Pengaturan Sistem &amp; Toko
        </h1>
        <p className="text-xs text-[#6B9071] mt-1">
          Pilih salah satu menu pengaturan di bawah ini untuk melihat, mengedit, dan menyimpan data.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* 1. Tombol Pengaturan Gmail & Email Web */}
          <button
            type="button"
            onClick={() => openSettingCategory('GMAIL')}
            className="p-5 rounded-3xl bg-[#F6F8F3] hover:bg-[#E3EED4]/65 border border-[#AEC3B0]/70 flex items-center justify-between gap-4 text-left transition-all group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] group-hover:text-[#375534]">
                  Pengaturan Gmail &amp; Email Web
                </h3>
                <p className="text-xs text-[#6B9071] truncate mt-0.5">
                  Laporan: {customService.report_email || 'rizzflow10@gmail.com'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#375534] shrink-0" />
          </button>

          {/* 2. Tombol Pengaturan Bot Notifikasi Telegram */}
          <button
            type="button"
            onClick={() => openSettingCategory('TELEGRAM_BOT')}
            className="p-5 rounded-3xl bg-[#F6F8F3] hover:bg-[#E3EED4]/65 border border-[#AEC3B0]/70 flex items-center justify-between gap-4 text-left transition-all group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#375534] text-white flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] group-hover:text-[#375534]">
                  Pengaturan Bot Notif Telegram
                </h3>
                <p className="text-xs text-[#6B9071] truncate mt-0.5">
                  {customService.telegram_bot_token
                    ? `Aktif (Chat ID: ${customService.telegram_chat_id || '-'})`
                    : 'Atur Bot Token & Chat ID Admin'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#375534] shrink-0" />
          </button>

          {/* 3. Tombol Pengaturan Kontak WhatsApp & Telegram Admin */}
          <button
            type="button"
            onClick={() => openSettingCategory('ADMIN_CONTACT')}
            className="p-5 rounded-3xl bg-[#F6F8F3] hover:bg-[#E3EED4]/65 border border-[#AEC3B0]/70 flex items-center justify-between gap-4 text-left transition-all group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] group-hover:text-[#375534]">
                  Kontak WhatsApp &amp; Telegram
                </h3>
                <p className="text-xs text-[#6B9071] truncate mt-0.5">
                  WA: {customService.admin_whatsapp || '-'} • Tele:{' '}
                  {customService.admin_telegram || '-'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#375534] shrink-0" />
          </button>

          {/* 4. Tombol Pengaturan Layanan Kustom */}
          <button
            type="button"
            onClick={() => openSettingCategory('CUSTOM_SERVICES')}
            className="p-5 rounded-3xl bg-[#F6F8F3] hover:bg-[#E3EED4]/65 border border-[#AEC3B0]/70 flex items-center justify-between gap-4 text-left transition-all group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#375534] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] group-hover:text-[#375534]">
                  Katalog Layanan Kustom
                </h3>
                <p className="text-xs text-[#6B9071] truncate mt-0.5">
                  {customService.services.length} jenis layanan kustom tersedia
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#375534] shrink-0" />
          </button>

          {/* 5. Tombol Pengaturan Identitas Utama Toko */}
          <button
            type="button"
            onClick={() => openSettingCategory('STORE_IDENTITY')}
            className="p-5 rounded-3xl bg-[#F6F8F3] hover:bg-[#E3EED4]/65 border border-[#AEC3B0]/70 flex items-center justify-between gap-4 text-left transition-all group md:col-span-2"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#0F2A1D] text-[#E3EED4] flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] group-hover:text-[#375534]">
                  Pengaturan Identitas Utama Toko ({settings.store_name})
                </h3>
                <p className="text-xs text-[#6B9071] truncate mt-0.5">
                  Atur nama toko, teks deskripsi banner beranda, dan kontak utama
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#375534] shrink-0" />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SUB-HALAMAN POP-UP PENGATURAN (DENGAN TOMBOL EDIT & AUTO-CLOSE SAVE) */}
      {/* ==================================================================== */}
      {activeSettingModal !== 'NONE' && (
        <div
          onClick={closeSettingModal}
          className="fixed inset-0 z-50 bg-[#0F2A1D]/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#F6F8F3] w-full max-w-lg rounded-[32px] p-6 shadow-2xl border border-[#AEC3B0] max-h-[90vh] overflow-y-auto space-y-5"
          >
            {/* Header Modal: Judul + Tombol Edit & Tombol Tutup */}
            <div className="flex items-center justify-between gap-2 border-b border-[#AEC3B0]/50 pb-3.5">
              <h3 className="font-extrabold text-base sm:text-lg text-[#0F2A1D]">
                {activeSettingModal === 'GMAIL' &&
                  'Pengaturan Gmail & Email Web'}
                {activeSettingModal === 'TELEGRAM_BOT' &&
                  'Pengaturan Bot Notifikasi Telegram'}
                {activeSettingModal === 'ADMIN_CONTACT' &&
                  'Pengaturan Kontak WhatsApp & Telegram'}
                {activeSettingModal === 'CUSTOM_SERVICES' &&
                  'Pengaturan Katalog Layanan Kustom'}
                {activeSettingModal === 'STORE_IDENTITY' &&
                  'Pengaturan Identitas Utama Toko'}
              </h3>

              <div className="flex items-center gap-2 shrink-0">
                {!isEditUnlocked ? (
                  <button
                    type="button"
                    onClick={() => setIsEditUnlocked(true)}
                    className="px-4 py-1.5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-[11px] font-extrabold border border-[#6B9071]">
                    Mode Edit Aktif
                  </span>
                )}

                <button
                  type="button"
                  onClick={closeSettingModal}
                  className="w-8 h-8 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center border border-[#AEC3B0]/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isEditUnlocked && (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[#E3EED4]/70 border border-[#6B9071]/50 flex items-center justify-between gap-2 text-xs text-[#0F2A1D]">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#375534] shrink-0" />
                  <span>
                    Data dikunci agar tidak terubah secara tidak sengaja. Klik tombol <strong>Edit</strong> di kanan atas untuk mengubah.
                  </span>
                </div>
              </div>
            )}

            {/* ISI MODAL 1: PENGATURAN GMAIL & EMAIL WEB (1 KOLOM EMAIL TERPADU + TOMBOL TES) */}
            {activeSettingModal === 'GMAIL' && (
              <form
                onSubmit={handleSaveCustomConfigAndClose}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Alamat Email Gmail Utama Toko (Pengirim ke Klien &amp; Penerima Laporan) *
                    </label>
                    <input
                      type="email"
                      required
                      disabled={!isEditUnlocked}
                      value={
                        customService.smtp_email ||
                        customService.report_email ||
                        'rizzflow55@gmail.com'
                      }
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          smtp_email: e.target.value,
                          report_email: e.target.value,
                        })
                      }
                      placeholder="Contoh: rizzflow55@gmail.com"
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm font-bold text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      App Password Gmail 16 Digit (Dari Akun Email di Atas) *
                    </label>
                    <input
                      type="password"
                      disabled={!isEditUnlocked}
                      value={customService.smtp_app_password || ''}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          smtp_app_password: e.target.value,
                        })
                      }
                      placeholder="Masukkan 16 digit Sandi Aplikasi dari Google Security"
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                    <p className="text-[11px] text-[#375534] mt-1.5 leading-relaxed">
                      * Penting: Karena kamu mengganti email ke <strong>rizzflow55@gmail.com</strong>, wajib isi 16 digit Sandi Aplikasi (App Password) yang dibuat dari akun Google <strong>rizzflow55@gmail.com</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeSettingModal}
                    className="px-4 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                  >
                    Tutup
                  </button>

                  {isEditUnlocked && (
                    <>
                      <button
                        type="button"
                        disabled={isSavingModal}
                        onClick={async () => {
                          setIsSavingModal(true);
                          try {
                            const res = await fetch('/api/messages', {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${accessToken}`,
                              },
                              body: JSON.stringify({
                                ...customService,
                                test_email: true,
                              }),
                            });
                            const data = (await res.json()) as {
                              customServiceConfig?: CustomServiceConfig;
                              message?: string;
                              error?: string;
                            };
                            if (!res.ok) {
                              throw new Error(
                                data.error || 'Gagal mengirim email tes.'
                              );
                            }
                            if (data.customServiceConfig) {
                              onChangeCustomService(data.customServiceConfig);
                            }
                            onShowFeedback(
                              'success',
                              data.message || 'Email tes berhasil dikirim!'
                            );
                            setActiveSettingModal('NONE');
                            setIsEditUnlocked(false);
                          } catch (err) {
                            onShowFeedback(
                              'error',
                              err instanceof Error
                                ? err.message
                                : 'Gagal mengirim email tes.'
                            );
                          } finally {
                            setIsSavingModal(false);
                          }
                        }}
                        className="px-4 py-2.5 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#E3EED4]" />
                        <span>Save &amp; Tes Kirim Email</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingModal}
                        className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                      >
                        {isSavingModal ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                            <span>Save &amp; Tutup</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {/* ISI MODAL 2: PENGATURAN BOT NOTIFIKASI TELEGRAM */}
            {activeSettingModal === 'TELEGRAM_BOT' && (
              <form
                onSubmit={handleSaveCustomConfigAndClose}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Telegram Bot Token (Dari @BotFather — @RizzFlow_Notif_bot)
                    </label>
                    <input
                      type="text"
                      disabled={!isEditUnlocked}
                      value={customService.telegram_bot_token || ''}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          telegram_bot_token: e.target.value,
                        })
                      }
                      placeholder="Contoh: 7123456789:AAHxyz..."
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Telegram Chat ID Kamu (Admin Penerima Laporan Pembelian)
                    </label>
                    <input
                      type="text"
                      disabled={!isEditUnlocked}
                      value={customService.telegram_chat_id || ''}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          telegram_chat_id: e.target.value,
                        })
                      }
                      placeholder="Contoh: 123456789"
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeSettingModal}
                    className="px-5 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                  >
                    Tutup
                  </button>
                  {isEditUnlocked && (
                    <button
                      type="submit"
                      disabled={isSavingModal}
                      className="px-6 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                          <span>Save &amp; Tutup</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ISI MODAL 3: PENGATURAN KONTAK WHATSAPP & TELEGRAM ADMIN */}
            {activeSettingModal === 'ADMIN_CONTACT' && (
              <form
                onSubmit={handleSaveCustomConfigAndClose}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Nomor WhatsApp Admin (Untuk Tombol Konsultasi Klien)
                    </label>
                    <input
                      type="text"
                      disabled={!isEditUnlocked}
                      value={customService.admin_whatsapp || ''}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          admin_whatsapp: e.target.value,
                        })
                      }
                      placeholder="Contoh: 081234567890"
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Username / Link Telegram Admin (Opsional)
                    </label>
                    <input
                      type="text"
                      disabled={!isEditUnlocked}
                      value={customService.admin_telegram || ''}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          admin_telegram: e.target.value,
                        })
                      }
                      placeholder="Contoh: @username_kamu"
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeSettingModal}
                    className="px-5 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                  >
                    Tutup
                  </button>
                  {isEditUnlocked && (
                    <button
                      type="submit"
                      disabled={isSavingModal}
                      className="px-6 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                          <span>Save &amp; Tutup</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ISI MODAL 4: PENGATURAN KATALOG LAYANAN KUSTOM */}
            {activeSettingModal === 'CUSTOM_SERVICES' && (
              <form
                onSubmit={handleSaveCustomConfigAndClose}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Judul Etalase Layanan Kustom *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isEditUnlocked}
                      value={customService.title}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          title: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Deskripsi Singkat Layanan Kustom *
                    </label>
                    <textarea
                      rows={2}
                      required
                      disabled={!isEditUnlocked}
                      value={customService.description}
                      onChange={(e) =>
                        onChangeCustomService({
                          ...customService,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-[#0F2A1D]">
                        Daftar Layanan Kustom *
                      </label>
                      {isEditUnlocked && (
                        <button
                          type="button"
                          onClick={handleAddServiceItem}
                          className="px-3 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      )}
                    </div>

                    {customService.services.map((srv, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          disabled={!isEditUnlocked}
                          value={srv}
                          onChange={(e) =>
                            handleUpdateServiceItem(idx, e.target.value)
                          }
                          className="flex-1 px-3.5 py-2.5 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-xl text-xs sm:text-sm text-[#0F2A1D]"
                        />
                        {isEditUnlocked &&
                          customService.services.length > 1 && (
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
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeSettingModal}
                    className="px-5 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                  >
                    Tutup
                  </button>
                  {isEditUnlocked && (
                    <button
                      type="submit"
                      disabled={isSavingModal}
                      className="px-6 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                          <span>Save &amp; Tutup</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ISI MODAL 5: PENGATURAN IDENTITAS UTAMA TOKO */}
            {activeSettingModal === 'STORE_IDENTITY' && (
              <form
                onSubmit={handleSaveStoreIdentityAndClose}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-white border border-[#AEC3B0]/60 space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Nama Toko *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isEditUnlocked}
                      value={settings.store_name}
                      onChange={(e) =>
                        onChangeSettings({
                          ...settings,
                          store_name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Deskripsi Banner Halaman Utama *
                    </label>
                    <textarea
                      rows={3}
                      required
                      disabled={!isEditUnlocked}
                      value={settings.banner_description}
                      onChange={(e) =>
                        onChangeSettings({
                          ...settings,
                          banner_description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#0F2A1D] mb-1.5">
                      Kontak Bantuan Utama (Email / WhatsApp) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isEditUnlocked}
                      value={settings.support_contact}
                      onChange={(e) =>
                        onChangeSettings({
                          ...settings,
                          support_contact: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F6F8F3] disabled:opacity-65 border border-[#AEC3B0] rounded-2xl text-xs sm:text-sm text-[#0F2A1D]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeSettingModal}
                    className="px-5 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                  >
                    Tutup
                  </button>
                  {isEditUnlocked && (
                    <button
                      type="submit"
                      disabled={isSavingModal}
                      className="px-6 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                          <span>Save &amp; Tutup</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}