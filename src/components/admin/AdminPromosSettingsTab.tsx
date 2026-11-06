'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
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
  const [promoCode, setPromoCode] = useState('');
  const [promoPercent, setPromoPercent] = useState('20');
  const [promoMaxRp, setPromoMaxRp] = useState('15000');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoExpiresAt, setPromoExpiresAt] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingCustomService, setIsSavingCustomService] = useState(false);

  useEffect(() => {
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setPromoStartsAt(now.toISOString().slice(0, 16));
    setPromoExpiresAt(nextWeek.toISOString().slice(0, 16));
  }, []);

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
      onShowFeedback('success', 'Pengaturan identitas toko berhasil disimpan!');
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setIsSavingSettings(false);
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
      if (data.customServiceConfig) {
        onChangeCustomService(data.customServiceConfig);
      }
      onShowFeedback(
        'success',
        data.message ||
          'Pengaturan Layanan Kustom & Notifikasi Telegram disimpan!'
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setIsSavingCustomService(false);
    }
  };

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

  return (
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

        <form onSubmit={handleSaveCustomServiceConfig} className="space-y-4">
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
                    onChangeCustomService({
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
                    onChangeCustomService({
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
                  onChangeCustomService({
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
                  onChangeCustomService({
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
                onChangeCustomService({
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
                onChangeCustomService({
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
                  onChange={(e) => handleUpdateServiceItem(idx, e.target.value)}
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
                onChangeSettings({ ...settings, store_name: e.target.value })
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
                onChangeSettings({
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
                onChangeSettings({
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
            {isSavingSettings ? 'Menyimpan...' : 'Simpan Identitas Toko'}
          </button>
        </form>
      </div>
    </div>
  );
}