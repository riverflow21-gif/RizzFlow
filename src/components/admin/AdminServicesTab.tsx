'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  Trash2,
  Loader2,
  Upload,
  Check,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
} from 'lucide-react';
import { CustomerSupportMessage, CustomProjectOrder } from '@/lib/supabase';
import { ServicesSubTab } from './AdminTypes';

interface AdminServicesTabProps {
  accessToken: string;
  customOrders: CustomProjectOrder[];
  supportMessages: CustomerSupportMessage[];
  servicesSubTab: ServicesSubTab;
  onChangeSubTab: (tab: ServicesSubTab) => void;
  onUpdateCustomOrders: (orders: CustomProjectOrder[]) => void;
  onUpdateMessages: (msgs: CustomerSupportMessage[]) => void;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
}

interface CloseConfirmationTarget {
  kind: 'CUSTOM_ORDER' | 'SUPPORT_MESSAGE';
  id: string;
  title: string;
  customerName: string;
}

type NullableConfirmTarget = CloseConfirmationTarget | null;
type NullableString = string | null;

export default function AdminServicesTab({
  accessToken,
  customOrders,
  supportMessages,
  servicesSubTab,
  onChangeSubTab,
  onUpdateCustomOrders,
  onUpdateMessages,
  onShowFeedback,
}: AdminServicesTabProps) {
  // Menyimpan ID baris antrian yang sedang dibuka detailnya (Klik untuk lihat detail)
  const [expandedCustomId, setExpandedCustomId] = useState(
    null as NullableString
  );
  const [expandedMsgId, setExpandedMsgId] = useState(null as NullableString);

  // Draft input Tahap 1 (Terima Pesanan & Estimasi) & Tahap 2 (Pengiriman Produk & Tagihan)
  const [estimateDraft, setEstimateDraft] = useState(
    {} as { [key: string]: string }
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

  // State Pop-up Verifikasi Konfirmasi sebelum menandai Selesai / Ditutup
  const [confirmTarget, setConfirmTarget] = useState(
    null as NullableConfirmTarget
  );
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  // TAHAP 1: Terima Pesanan & Kirim Jawaban Sementara (Sedang Diproses + Estimasi Selesai)
  const handleAcceptOrderWithEstimate = async (
    customOrd: CustomProjectOrder
  ) => {
    const estText = (
      estimateDraft[customOrd.id] !== undefined
        ? estimateDraft[customOrd.id]
        : customOrd.estimated_completion || ''
    ).trim();

    if (!estText) {
      onShowFeedback(
        'error',
        'Harap isi Estimasi Pengerjaan Sampai Selesai (contoh: 2 Hari Kerja / Selesai Jumat Sore).'
      );
      return;
    }

    const rawPrice =
      customPriceDraft[customOrd.id] !== undefined
        ? customPriceDraft[customOrd.id]
        : String(customOrd.price || '');
    const numericPrice = Math.max(0, Number(rawPrice) || 0);

    const tempNote =
      customNoteDraft[customOrd.id] !== undefined &&
      customNoteDraft[customOrd.id].trim().length > 0
        ? customNoteDraft[customOrd.id].trim()
        : `Pesanan layanan kustom kamu telah kami terima dan saat ini sedang dalam proses pengerjaan. Estimasi selesai: ${estText}.`;

    setUpdatingCustomId(customOrd.id);
    try {
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target_type: 'CUSTOM_ORDER',
          step_action: 'ACCEPT_ESTIMATE',
          id: customOrd.id,
          status: 'DIPROSES',
          estimated_completion: estText,
          price: numericPrice,
          admin_note: tempNote,
        }),
      });

      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim jawaban sementara.');
      }

      if (data.customOrders) onUpdateCustomOrders(data.customOrders);
      onShowFeedback(
        'success',
        data.message ||
          `Pesanan ${customOrd.order_code} diterima & estimasi pengerjaan telah dikirim ke klien!`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal memproses pesanan.'
      );
    } finally {
      setUpdatingCustomId(null);
    }
  };

  // TAHAP 2: Upload Produk Kustom yang Sudah Siap & Kirim Tagihan Pembayaran
  const handleUploadAndSendCustomBill = async (
    customOrd: CustomProjectOrder
  ) => {
    const rawPrice =
      customPriceDraft[customOrd.id] !== undefined
        ? customPriceDraft[customOrd.id]
        : String(customOrd.price || '');
    const numericPrice = Math.max(0, Number(rawPrice) || 0);

    if (numericPrice < 1000) {
      onShowFeedback(
        'error',
        'Harap isi Harga Tagihan minimal Rp1.000 sebelum mengirim tagihan ke klien.'
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
      onShowFeedback(
        'error',
        'Harap unggah minimal 1 File Produk Kustom ATAU isi Link Hasil Pengerjaan terlebih dahulu.'
      );
      return;
    }

    setUpdatingCustomId(customOrd.id);
    try {
      const { supabase } = await import('@/lib/supabase');
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
        customNoteDraft[customOrd.id] !== undefined &&
        customNoteDraft[customOrd.id].trim().length > 0
          ? customNoteDraft[customOrd.id].trim()
          : 'Produk kustom kamu telah selesai dikerjakan! Silakan selesaikan pembayaran tagihan via QRIS untuk mengunduh file produkmu.';

      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target_type: 'CUSTOM_ORDER',
          step_action: 'SEND_BILL',
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

      if (data.customOrders) onUpdateCustomOrders(data.customOrders);
      onShowFeedback(
        'success',
        data.message ||
          `Tagihan pesanan ${customOrd.order_code} telah dikirim ke klien!`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal memproses pesanan kustom.'
      );
    } finally {
      setUpdatingCustomId(null);
    }
  };

  // TAHAP 3: Eksekusi Selesaikan / Tutup setelah konfirmasi modal
  const handleProceedConfirmedClose = async () => {
    if (!confirmTarget) return;
    setIsConfirmingClose(true);

    try {
      if (confirmTarget.kind === 'CUSTOM_ORDER') {
        const res = await fetch('/api/messages', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            target_type: 'CUSTOM_ORDER',
            step_action: 'COMPLETE_CLOSE',
            id: confirmTarget.id,
            status: 'LUNAS',
            admin_note:
              'Pesanan layanan kustom telah diselesaikan dan ditutup oleh Admin.',
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            customOrders?: CustomProjectOrder[];
          };
          if (data.customOrders) onUpdateCustomOrders(data.customOrders);
          onShowFeedback(
            'success',
            `Pesanan kustom "${confirmTarget.title}" berhasil diselesaikan dan ditutup.`
          );
        }
      } else {
        const res = await fetch('/api/messages', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            target_type: 'MESSAGE',
            id: confirmTarget.id,
            status: 'SELESAI',
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            messages?: CustomerSupportMessage[];
          };
          if (data.messages) onUpdateMessages(data.messages);
          onShowFeedback(
            'success',
            `Pesan dari ${confirmTarget.customerName} telah ditandai Selesai/Ditutup.`
          );
        }
      }
    } catch {
      onShowFeedback('error', 'Gagal menyelesaikan item.');
    } finally {
      setIsConfirmingClose(false);
      setConfirmTarget(null);
    }
  };

  const handleReopenMessage = async (msg: CustomerSupportMessage) => {
    const res = await fetch('/api/messages', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        target_type: 'MESSAGE',
        id: msg.id,
        status: 'BARU',
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: CustomerSupportMessage[];
      };
      if (data.messages) onUpdateMessages(data.messages);
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
      if (data.customOrders) onUpdateCustomOrders(data.customOrders);
      onShowFeedback('success', 'Data pesanan kustom dihapus.');
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
      if (data.messages) onUpdateMessages(data.messages);
      onShowFeedback('success', 'Pesan dihapus.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Switch Sub-Halaman: Antrian Proyek Kustom vs Kotak Masuk Klaim */}
      <div className="grid grid-cols-2 gap-2.5 bg-white p-2 rounded-full border border-[#AEC3B0]/60 rf-card-shadow">
        <button
          type="button"
          onClick={() => onChangeSubTab('CUSTOM_ORDERS')}
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
          onClick={() => onChangeSubTab('INBOX_MESSAGES')}
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
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#0F2A1D]">
              Antrian Layanan Kustom — Klik Pesanan untuk Membuka Detail &amp; Alur
            </h2>
            <p className="text-xs text-[#6B9071] mt-0.5">
              Semua antrian ditampilkan seragam. Ketuk salah satu baris pesanan untuk memproses <strong>Tahap 1 (Terima &amp; Estimasi)</strong> $\rightarrow$ <strong>Tahap 2 (Upload Produk &amp; Tagihan)</strong> $\rightarrow$ <strong>Tahap 3 (Selesai)</strong>.
            </p>
          </div>

          {customOrders.length === 0 ? (
            <p className="text-sm text-[#6B9071] text-center py-12">
              Belum ada antrian pesanan layanan kustom.
            </p>
          ) : (
            <div className="space-y-2.5">
              {customOrders.map((cOrd) => {
                const isExpanded = expandedCustomId === cOrd.id;
                const isBusy = updatingCustomId === cOrd.id;

                const estVal =
                  estimateDraft[cOrd.id] !== undefined
                    ? estimateDraft[cOrd.id]
                    : cOrd.estimated_completion || '';
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

                const cleanWa = cOrd.customer_contact.replace(/[^0-9]/g, '');
                const waUrl = cleanWa
                  ? `https://wa.me/${
                      cleanWa.startsWith('0')
                        ? '62' + cleanWa.slice(1)
                        : cleanWa
                    }`
                  : null;

                const channelLabel =
                  cOrd.notify_channel === 'TELEGRAM'
                    ? '🤖 Notif Telegram'
                    : cOrd.notify_channel === 'BOTH'
                    ? '📧+🤖 Email & Tele'
                    : '📧 Notif Email';

                return (
                  <div
                    key={cOrd.id}
                    className="rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/70 overflow-hidden transition-all"
                  >
                    {/* BARIS ANTRIAN SERAGAM (UKURAN KOLOM SAMA UNTUK SEMUA PESANAN) */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCustomId(isExpanded ? null : cOrd.id)
                      }
                      className="w-full h-18 px-4 flex items-center justify-between gap-3 text-left hover:bg-[#E3EED4]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="px-3 py-1.5 rounded-xl bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold tracking-wider shrink-0 inline-flex items-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          <span>{cOrd.order_code}</span>
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] truncate">
                              {cOrd.project_title}
                            </span>
                            <span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-white border border-[#AEC3B0] text-[10px] font-bold text-[#375534] shrink-0">
                              {channelLabel}
                            </span>
                          </div>
                          <span className="block text-[11px] text-[#6B9071] truncate">
                            Pemesan: {cOrd.customer_name}
                            {cOrd.estimated_completion
                              ? ` • Estimasi: ${cOrd.estimated_completion}`
                              : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={
                            cOrd.status === 'LUNAS'
                              ? 'px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#0F2A1D] text-[#E3EED4]'
                              : cOrd.status === 'SIAP_DIBAYAR'
                              ? 'px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#375534] text-white'
                              : cOrd.status === 'DIPROSES'
                              ? 'px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#E3EED4] text-[#0F2A1D] border border-[#375534]'
                              : 'px-3 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300'
                          }
                        >
                          {cOrd.status === 'LUNAS'
                            ? '3. SELESAI / LUNAS'
                            : cOrd.status === 'SIAP_DIBAYAR'
                            ? '2. MENUNGGU BAYAR'
                            : cOrd.status === 'DIPROSES'
                            ? '1. SEDANG DIPROSES'
                            : 'PESANAN BARU'}
                        </span>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#0F2A1D]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#6B9071]" />
                        )}
                      </div>
                    </button>

                    {/* DETAIL PESANAN & ALUR BERTAHAP (HANYA MUNCUL SAAT DIKLIK) */}
                    {isExpanded && (
                      <div className="p-5 bg-white border-t border-[#AEC3B0]/60 space-y-5">
                        {/* Indikator Alur 3 Tahap */}
                        <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 text-center text-[11px] font-extrabold">
                          <div
                            className={
                              cOrd.status === 'MENUNGGU_PENGERJAAN' ||
                              cOrd.status === 'DIPROSES'
                                ? 'py-2 px-2 rounded-xl bg-[#0F2A1D] text-[#E3EED4]'
                                : 'py-2 px-2 rounded-xl bg-[#E3EED4] text-[#0F2A1D]'
                            }
                          >
                            1. Terima &amp; Estimasi
                          </div>
                          <div
                            className={
                              cOrd.status === 'SIAP_DIBAYAR'
                                ? 'py-2 px-2 rounded-xl bg-[#0F2A1D] text-[#E3EED4]'
                                : cOrd.status === 'LUNAS'
                                ? 'py-2 px-2 rounded-xl bg-[#E3EED4] text-[#0F2A1D]'
                                : 'py-2 px-2 rounded-xl text-[#6B9071]'
                            }
                          >
                            2. Kirim Produk &amp; Tagihan
                          </div>
                          <div
                            className={
                              cOrd.status === 'LUNAS'
                                ? 'py-2 px-2 rounded-xl bg-[#0F2A1D] text-[#E3EED4]'
                                : 'py-2 px-2 rounded-xl text-[#6B9071]'
                            }
                          >
                            3. Selesai &amp; Lunas
                          </div>
                        </div>

                        {/* Info Kontak & Permintaan Klien */}
                        <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[#0F2A1D]">
                              <strong>Klien:</strong> {cOrd.customer_name} •{' '}
                              <strong>Notifikasi:</strong> {channelLabel}
                              {cOrd.customer_email &&
                                ` • Email: ${cOrd.customer_email}`}
                              {cOrd.customer_telegram_id &&
                                ` • ID Tele: ${cOrd.customer_telegram_id}`}
                              {cOrd.customer_contact &&
                                ` • WA: ${cOrd.customer_contact}`}
                            </p>
                            <span className="text-[11px] text-[#6B9071]">
                              {new Date(cOrd.created_at).toLocaleString(
                                'id-ID'
                              )}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-[#AEC3B0]/50 text-[#0F2A1D] whitespace-pre-line">
                            <strong className="text-[#375534] block mb-0.5">
                              Detail Spesifikasi yang Diminta Klien:
                            </strong>
                            {cOrd.request_details}
                          </div>
                        </div>

                        {/* KOTAK TAHAP 1: TERIMA PESANAN & KIRIM ESTIMASI PENGERJAAN */}
                        <div className="p-4 rounded-2xl bg-[#E3EED4]/45 border border-[#6B9071]/60 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0F2A1D]">
                            <Clock className="w-4 h-4 text-[#375534]" />
                            <span>
                              TAHAP 1 — Terima Pesanan &amp; Beri Jawaban Sementara (Estimasi Selesai)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                                Estimasi Pengerjaan Sampai Selesai *
                              </label>
                              <input
                                type="text"
                                value={estVal}
                                onChange={(e) =>
                                  setEstimateDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.value,
                                  }))
                                }
                                placeholder="Contoh: 2 Hari Kerja / Selesai Jumat pukul 17.00"
                                className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs font-bold text-[#0F2A1D]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                                Pesan Sementara / Catatan Progres untuk Klien:
                              </label>
                              <input
                                type="text"
                                value={noteVal}
                                onChange={(e) =>
                                  setCustomNoteDraft((prev) => ({
                                    ...prev,
                                    [cOrd.id]: e.target.value,
                                  }))
                                }
                                placeholder="Contoh: Pesanan diterima dan sedang kami kerjakan..."
                                className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs text-[#0F2A1D]"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleAcceptOrderWithEstimate(cOrd)}
                            className="px-4 py-2 rounded-full bg-[#375534] hover:bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5 text-[#E3EED4]" />
                            <span>
                              {cOrd.status === 'DIPROSES'
                                ? 'Perbarui Estimasi & Kirim Ulang Notif'
                                : '1. Terima Pesanan & Kirim Estimasi ke Klien'}
                            </span>
                          </button>
                        </div>

                        {/* KOTAK TAHAP 2: UPLOAD PRODUK SELESAI & KIRIM TAGIHAN PEMBAYARAN */}
                        <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0] space-y-3">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0F2A1D]">
                            <Upload className="w-4 h-4 text-[#375534]" />
                            <span>
                              TAHAP 2 — Pengiriman Produk Kustom &amp; Tagihan Pembayaran
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                                Harga Tagihan Proyek Kustom (Rp) *
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
                                className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs font-bold text-[#0F2A1D]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                                Link Hasil Pengerjaan (Opsional — GDrive/Web)
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
                                className="w-full px-3.5 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs text-[#0F2A1D]"
                              />
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-dashed border-[#375534]">
                            <label className="block text-[11px] font-bold text-[#0F2A1D] mb-1">
                              Upload File Produk Kustom yang Sudah Selesai
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
                              className="text-xs text-[#0F2A1D] w-full"
                            />
                            {pickedFiles.length > 0 ? (
                              <p className="text-[11px] font-extrabold text-[#375534] mt-1">
                                ✓ {pickedFiles.length} file baru siap diunggah
                              </p>
                            ) : cOrd.file_paths.length > 0 ? (
                              <p className="text-[11px] font-extrabold text-[#0F2A1D] mt-1">
                                ✓ {cOrd.file_paths.length} file sudah terunggah
                              </p>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUploadAndSendCustomBill(cOrd)}
                            className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm transition-colors"
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Mengunggah &amp; Mengirim Notif...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-[#E3EED4]" />
                                <span>
                                  2. Tandai Produk Siap &amp; Kirim Tagihan Pembayaran
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* BARIS BAWAH: TAHAP 3 (SELESAIKAN / TUTUP) & HAPUS */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#AEC3B0]/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            {cOrd.status !== 'LUNAS' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmTarget({
                                    kind: 'CUSTOM_ORDER',
                                    id: cOrd.id,
                                    title: `${cOrd.order_code} (${cOrd.project_title})`,
                                    customerName: cOrd.customer_name,
                                  })
                                }
                                className="px-4 py-2 rounded-full bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>3. Selesaikan / Tutup Pesanan</span>
                              </button>
                            )}

                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-bold"
                              >
                                Chat WA Klien
                              </a>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteCustomOrder(cOrd.id)}
                            className="px-3.5 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Antrian</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* KOTAK MASUK KLAIM GARANSI & PERTANYAAN (BARIS SERAGAM, KLIK UNTUK DETAIL) */
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#0F2A1D]">
              Kotak Masuk Klaim Garansi &amp; Pertanyaan ({supportMessages.length})
            </h2>
            <p className="text-xs text-[#6B9071]">
              Ketuk salah satu baris pesan untuk membaca isi lengkapnya atau menandai Selesai/Ditutup.
            </p>
          </div>

          {supportMessages.length === 0 ? (
            <p className="text-sm text-[#6B9071] text-center py-12">
              Belum ada pesan masuk.
            </p>
          ) : (
            <div className="space-y-2.5">
              {supportMessages.map((msg) => {
                const isExpanded = expandedMsgId === msg.id;
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
                        ? 'rounded-2xl border overflow-hidden bg-[#E3EED4]/40 border-[#6B9071]'
                        : 'rounded-2xl border overflow-hidden bg-[#F6F8F3] border-[#AEC3B0]/60'
                    }
                  >
                    {/* Baris Ringkas Seragam */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMsgId(isExpanded ? null : msg.id)
                      }
                      className="w-full h-16 px-4 flex items-center justify-between gap-3 text-left hover:bg-[#E3EED4]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#0F2A1D] text-[#E3EED4] shrink-0">
                          {msg.type === 'KLAIM_GARANSI'
                            ? '🛡️ Klaim'
                            : msg.type === 'LAYANAN_KHUSUS'
                            ? '✨ Kustom'
                            : '💬 Tanya'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-xs sm:text-sm text-[#0F2A1D] block truncate">
                            {msg.sender_name}{' '}
                            {msg.invoice_number
                              ? `(${msg.invoice_number})`
                              : ''}
                          </span>
                          <span className="text-[11px] text-[#6B9071] block truncate">
                            {msg.message}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={
                            msg.status === 'BARU'
                              ? 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#375534] text-white'
                              : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#AEC3B0] text-[#6B9071]'
                          }
                        >
                          {msg.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#0F2A1D]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#6B9071]" />
                        )}
                      </div>
                    </button>

                    {/* Detail Pesan Saat Diklik */}
                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-[#AEC3B0]/50 space-y-3 text-xs">
                        <p className="text-[#0F2A1D] break-all">
                          <strong>Kontak / Email:</strong> {msg.sender_email}
                          {msg.sender_contact && ` • WA: ${msg.sender_contact}`}
                          {msg.invoice_number &&
                            ` • Kode/Invoice: ${msg.invoice_number}`}
                        </p>

                        <div className="p-3.5 rounded-xl bg-[#F6F8F3] border border-[#AEC3B0]/50 text-[#0F2A1D] whitespace-pre-line break-words">
                          {msg.message}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 rounded-full bg-[#375534] text-white font-bold"
                              >
                                Balas via WhatsApp
                              </a>
                            )}
                            {msg.sender_email.includes('@') && (
                              <a
                                href={`mailto:${msg.sender_email}?subject=Balasan%20Admin%20RizzFlow`}
                                className="px-3.5 py-1.5 rounded-full bg-[#F6F8F3] border border-[#AEC3B0] text-[#0F2A1D] font-bold"
                              >
                                Balas via Email
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {msg.status === 'BARU' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmTarget({
                                    kind: 'SUPPORT_MESSAGE',
                                    id: msg.id,
                                    title:
                                      msg.type === 'KLAIM_GARANSI'
                                        ? 'Klaim Garansi'
                                        : 'Pesan Pelanggan',
                                    customerName: msg.sender_name,
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold inline-flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Selesai / Tutup</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReopenMessage(msg)}
                                className="px-3 py-1.5 rounded-full bg-[#F6F8F3] border border-[#AEC3B0] text-[#6B9071] font-bold"
                              >
                                Buka Lagi
                              </button>
                            )}

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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL VERIFIKASI KONFIRMASI SELESAIKAN / TUTUP */}
      {confirmTarget && (
        <div
          onClick={() => !isConfirmingClose && setConfirmTarget(null)}
          className="fixed inset-0 z-50 bg-[#0F2A1D]/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#AEC3B0] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#AEC3B0]/40 pb-3">
              <div className="flex items-center gap-2 text-[#0F2A1D]">
                <AlertCircle className="w-5 h-5 text-[#375534]" />
                <h3 className="font-extrabold text-base">
                  Konfirmasi Selesaikan &amp; Tutup
                </h3>
              </div>
              <button
                type="button"
                disabled={isConfirmingClose}
                onClick={() => setConfirmTarget(null)}
                className="p-1.5 rounded-full bg-[#F6F8F3] text-[#0F2A1D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#375534] leading-relaxed">
              Apakah kamu yakin ingin menandai{' '}
              <strong className="text-[#0F2A1D]">{confirmTarget.title}</strong>{' '}
              dari pelanggan{' '}
              <strong className="text-[#0F2A1D]">
                {confirmTarget.customerName}
              </strong>{' '}
              sebagai <strong>Selesai / Ditutup</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isConfirmingClose}
                onClick={() => setConfirmTarget(null)}
                className="px-5 py-2.5 rounded-full bg-[#F6F8F3] hover:bg-[#E3EED4] text-[#0F2A1D] font-extrabold text-xs transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isConfirmingClose}
                onClick={handleProceedConfirmedClose}
                className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                {isConfirmingClose ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                    <span>Ya, Selesaikan &amp; Tutup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}