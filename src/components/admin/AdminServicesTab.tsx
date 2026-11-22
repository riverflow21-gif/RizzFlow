'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  Inbox,
  Sparkles,
  CheckCircle2,
  Pencil,
  X,
  Share2,
  QrCode,
  FileText,
} from 'lucide-react';
import {
  supabase,
  CustomProjectOrder,
  CustomerSupportMessage,
} from '@/lib/supabase';
import { ServicesSubTab } from './AdminTypes';

interface AdminServicesTabProps {
  accessToken: string;
  customOrders: CustomProjectOrder[];
  messages: CustomerSupportMessage[];
  onUpdateCustomOrders: (next: CustomProjectOrder[]) => void;
  onUpdateMessages: (next: CustomerSupportMessage[]) => void;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
}

const STORE_PUBLIC_URL = 'https://rizzflow-theta.vercel.app';

export default function AdminServicesTab({
  accessToken,
  customOrders,
  messages,
  onUpdateCustomOrders,
  onUpdateMessages,
  onShowFeedback,
}: AdminServicesTabProps) {
  const [subTab, setSubTab] = useState('CUSTOM_ORDERS' as ServicesSubTab);

  // State Form Buat Tagihan Kustom Baru (Setelah Deal via Chat)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [billPrice, setBillPrice] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [uploadedPaths, setUploadedPaths] = useState([] as string[]);
  const [deliveryLinks, setDeliveryLinks] = useState([''] as string[]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isCreatingBill, setIsCreatingBill] = useState(false);

  // Kartu hasil tagihan yang baru dibuat (siap salin ke WA/Telegram)
  const [newlyCreatedOrder, setNewlyCreatedOrder] = useState(
    null as CustomProjectOrder | null
  );
  const [copiedId, setCopiedId] = useState(null as string | null);

  // State Edit Tagihan yang sudah ada
  const [editingOrder, setEditingOrder] = useState(
    null as CustomProjectOrder | null
  );
  const [editPrice, setEditPrice] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editFiles, setEditFiles] = useState([] as string[]);
  const [editLinks, setEditLinks] = useState([''] as string[]);
  const [isUploadingEditFile, setIsUploadingEditFile] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State Loading per Item (Tandai Lunas / Hapus / Pesan Selesai)
  const [busyItemId, setBusyItemId] = useState(null as string | null);

  const buildBillShareUrl = (orderCode: string) =>
    `${STORE_PUBLIC_URL}/?tab=services&kode=${encodeURIComponent(orderCode)}`;

  const buildReadyShareMessage = (ord: CustomProjectOrder) => {
    const link = buildBillShareUrl(ord.order_code);
    return (
      `Halo ${ord.customer_name}, pesanan layanan kustom "${ord.project_title}" kamu sudah siap!\n\n` +
      `Kode Tagihan: ${ord.order_code}\n` +
      `Total Pembayaran: Rp${ord.price.toLocaleString('id-ID')}\n\n` +
      `Silakan buka link di bawah ini untuk membayar via QRIS dan langsung mengunduh file produkmu:\n${link}`
    );
  };

  const handleCopyText = (text: string, keyId: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(keyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleUploadCustomFiles = async (
    files: FileList | null,
    targetMode: 'create' | 'edit'
  ) => {
    if (!files || files.length === 0) return;

    if (targetMode === 'create') {
      setIsUploadingFile(true);
    } else {
      setIsUploadingEditFile(true);
    }

    try {
      const addedPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `custom-orders/${Date.now()}-${i}-${safeName}`;

        const { error } = await supabase.storage
          .from('digital-products')
          .upload(path, file, { upsert: false });

        if (error) {
          throw new Error(`Gagal mengunggah ${file.name}: ${error.message}`);
        }
        addedPaths.push(path);
      }

      if (targetMode === 'create') {
        setUploadedPaths((prev) => [...prev, ...addedPaths]);
      } else {
        setEditFiles((prev) => [...prev, ...addedPaths]);
      }

      onShowFeedback(
        'success',
        `${addedPaths.length} file produk kustom berhasil diunggah!`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal mengunggah file.'
      );
    } finally {
      if (targetMode === 'create') {
        setIsUploadingFile(false);
      } else {
        setIsUploadingEditFile(false);
      }
    }
  };

  const handleCreateCustomBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingBill(true);

    try {
      const cleanLinks = deliveryLinks
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'ADMIN_CREATE_CUSTOM_BILL',
          customer_name: customerName,
          customer_email: customerEmail,
          project_title: projectTitle,
          price: Math.max(1, Number(billPrice) || 0),
          admin_note: adminNote,
          file_paths: uploadedPaths,
          delivery_links: cleanLinks,
        }),
      });

      const data = (await res.json()) as {
        customOrder?: CustomProjectOrder;
        customOrders?: CustomProjectOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.customOrder) {
        throw new Error(data.error || 'Gagal membuat tagihan kustom.');
      }

      if (data.customOrders) {
        onUpdateCustomOrders(data.customOrders);
      }
      setNewlyCreatedOrder(data.customOrder);
      setIsCreateOpen(false);

      // Reset form
      setCustomerName('');
      setCustomerEmail('');
      setProjectTitle('');
      setBillPrice('');
      setAdminNote('');
      setUploadedPaths([]);
      setDeliveryLinks(['']);

      onShowFeedback(
        'success',
        data.message || `Tagihan ${data.customOrder.order_code} siap dikirim!`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal membuat tagihan kustom.'
      );
    } finally {
      setIsCreatingBill(false);
    }
  };

  const openEditModal = (ord: CustomProjectOrder) => {
    setEditingOrder(ord);
    setEditPrice(String(ord.price || ''));
    setEditNote(ord.admin_note || '');
    setEditFiles(Array.isArray(ord.file_paths) ? [...ord.file_paths] : []);
    setEditLinks(
      Array.isArray(ord.delivery_links) && ord.delivery_links.length > 0
        ? [...ord.delivery_links]
        : ['']
    );
  };

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingEdit(true);

    try {
      const cleanLinks = editLinks
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target: 'CUSTOM_ORDER',
          id: editingOrder.id,
          price: Math.max(1, Number(editPrice) || 1),
          admin_note: editNote,
          file_paths: editFiles,
          delivery_links: cleanLinks,
        }),
      });

      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan perubahan tagihan.');
      }

      if (data.customOrders) onUpdateCustomOrders(data.customOrders);
      setEditingOrder(null);
      onShowFeedback('success', data.message || 'Tagihan kustom diperbarui!');
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleMarkOrderPaidManual = async (ord: CustomProjectOrder) => {
    setBusyItemId(`paid-${ord.id}`);
    try {
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target: 'CUSTOM_ORDER',
          id: ord.id,
          status: 'LUNAS',
        }),
      });

      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
        message?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error || 'Gagal menandai lunas.');
      if (data.customOrders) onUpdateCustomOrders(data.customOrders);
      onShowFeedback(
        'success',
        data.message || `Tagihan ${ord.order_code} ditandai LUNAS.`
      );
    } catch (err) {
      onShowFeedback(
        'error',
        err instanceof Error ? err.message : 'Gagal menandai lunas.'
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteCustomOrder = async (ord: CustomProjectOrder) => {
    setBusyItemId(`del-${ord.id}`);
    try {
      const res = await fetch(
        `/api/messages?type=custom_order&id=${encodeURIComponent(ord.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = (await res.json()) as {
        customOrders?: CustomProjectOrder[];
      };

      if (res.ok && data.customOrders) {
        onUpdateCustomOrders(data.customOrders);
        if (newlyCreatedOrder?.id === ord.id) setNewlyCreatedOrder(null);
        onShowFeedback('success', `Tagihan ${ord.order_code} dihapus.`);
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const handleToggleMessageStatus = async (msg: CustomerSupportMessage) => {
    setBusyItemId(`msg-${msg.id}`);
    try {
      const nextStatus = msg.status === 'BARU' ? 'SELESAI' : 'BARU';
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target: 'MESSAGE',
          id: msg.id,
          message_status: nextStatus,
        }),
      });
      const data = (await res.json()) as {
        messages?: CustomerSupportMessage[];
      };
      if (res.ok && data.messages) {
        onUpdateMessages(data.messages);
        onShowFeedback('success', 'Status pesan diperbarui.');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setBusyItemId(`delmsg-${msgId}`);
    try {
      const res = await fetch(
        `/api/messages?id=${encodeURIComponent(msgId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = (await res.json()) as {
        messages?: CustomerSupportMessage[];
      };
      if (res.ok && data.messages) {
        onUpdateMessages(data.messages);
        onShowFeedback('success', 'Pesan dihapus.');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const unreadCount = messages.filter((m) => m.status === 'BARU').length;
  const activeBillsCount = customOrders.filter(
    (o) => o.status !== 'LUNAS' && o.status !== 'DIBATALKAN'
  ).length;

  return (
    <div className="space-y-6">
      {/* Sub-Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-white p-1.5 rounded-full border border-[#AEC3B0]/60 rf-card-shadow">
          <button
            type="button"
            onClick={() => setSubTab('CUSTOM_ORDERS')}
            className={
              subTab === 'CUSTOM_ORDERS'
                ? 'px-4 py-2 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5'
                : 'px-4 py-2 rounded-full text-[#375534] text-xs font-bold inline-flex items-center gap-1.5'
            }
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tagihan Kustom ({activeBillsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('INBOX_MESSAGES')}
            className={
              subTab === 'INBOX_MESSAGES'
                ? 'px-4 py-2 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5'
                : 'px-4 py-2 rounded-full text-[#375534] text-xs font-bold inline-flex items-center gap-1.5'
            }
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Garansi &amp; Pesan ({unreadCount} Baru)</span>
          </button>
        </div>

        {subTab === 'CUSTOM_ORDERS' && (
          <button
            type="button"
            onClick={() => setIsCreateOpen((v) => !v)}
            className="px-5 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
          >
            {isCreateOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Tutup Formulir</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Buat Tagihan Kustom Baru</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SUB-TAB 1: TAGIHAN & PROYEK KUSTOM (ALUR CHAT -> BUAT TAGIHAN DI WEB) */}
      {/* ==================================================================== */}
      {subTab === 'CUSTOM_ORDERS' && (
        <div className="space-y-6">
          {/* Kartu Hasil Tagihan Baru (Langsung Siap Salin ke WA/Telegram Klien) */}
          {newlyCreatedOrder && (
            <div className="p-5 sm:p-6 rounded-3xl bg-[#E3EED4] border-2 border-[#375534] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-[11px] font-extrabold">
                    ✅ TAGIHAN KUSTOM SIAP DIKIRIM KE PELANGGAN
                  </span>
                  <h3 className="text-lg font-extrabold text-[#0F2A1D] mt-1.5">
                    {newlyCreatedOrder.order_code} —{' '}
                    {newlyCreatedOrder.project_title} (Rp
                    {newlyCreatedOrder.price.toLocaleString('id-ID')})
                  </h3>
                  <p className="text-xs text-[#375534]">
                    Kirim kode atau pesan di bawah ini ke WhatsApp / Telegram{' '}
                    <strong>{newlyCreatedOrder.customer_name}</strong> agar dia
                    bisa langsung bayar via QRIS di website.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewlyCreatedOrder(null)}
                  className="w-8 h-8 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      buildReadyShareMessage(newlyCreatedOrder),
                      `new-msg-${newlyCreatedOrder.id}`
                    )
                  }
                  className="px-4 py-2.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  {copiedId === `new-msg-${newlyCreatedOrder.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Pesan WA/Tele Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Salin Pesan Siap Kirim (WA/Tele)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      buildBillShareUrl(newlyCreatedOrder.order_code),
                      `new-link-${newlyCreatedOrder.id}`
                    )
                  }
                  className="px-4 py-2.5 rounded-full bg-white border border-[#375534] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  {copiedId === `new-link-${newlyCreatedOrder.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link Langsung</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Form Buat Tagihan Kustom Baru */}
          {isCreateOpen && (
            <form
              onSubmit={handleCreateCustomBill}
              className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-[#0F2A1D] rf-card-shadow space-y-4"
            >
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#0F2A1D]">
                  Buat Tagihan Pembayaran Layanan Kustom
                </h2>
                <p className="text-xs text-[#6B9071] mt-0.5">
                  Isi harga deal dan unggah file/link hasil proyek setelah
                  berdiskusi dengan pelanggan via chat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-xl text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Email Pelanggan (Opsional — untuk salinan file ke email)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Kosongkan jika cukup unduh di web"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Nama Proyek Kustom *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="Contoh: Landing Page Usaha Kopi / Rumus Excel"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-xl text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                    Harga Deal (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={billPrice}
                    onChange={(e) => setBillPrice(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                  Catatan untuk Pelanggan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Misal: File sudah direvisi sesuai permintaan, silakan selesaikan pembayaran QRIS untuk mengunduh."
                  className="w-full px-3.5 py-2.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Upload File Hasil Proyek */}
              <div className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/70 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#0F2A1D]">
                    Upload File Produk Kustom (ZIP / PDF / XLSX / PPTX)
                  </span>
                  <label className="px-3.5 py-1.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer">
                    {isUploadingFile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih File</span>
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      disabled={isUploadingFile}
                      onChange={(e) =>
                        handleUploadCustomFiles(e.target.files, 'create')
                      }
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadedPaths.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedPaths.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#AEC3B0] text-xs"
                      >
                        <span className="truncate font-semibold text-[#0F2A1D] inline-flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#375534] shrink-0" />
                          <span>{p.split('/').pop()}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedPaths((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link Akses Produk (Google Drive / GitHub / Hosting) */}
                <div className="pt-2 border-t border-[#AEC3B0]/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0F2A1D] inline-flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5 text-[#375534]" />
                      <span>Atau Link Akses Produk (Drive / Notion / Web)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeliveryLinks((prev) => [...prev, ''])}
                      className="px-2.5 py-1 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-[11px] font-bold"
                    >
                      + Tambah Link
                    </button>
                  </div>

                  {deliveryLinks.map((lnk, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={lnk}
                        onChange={(e) =>
                          setDeliveryLinks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? e.target.value : item
                            )
                          )
                        }
                        placeholder="https://drive.google.com/..."
                        className="flex-1 px-3 py-2 bg-white border border-[#AEC3B0] rounded-xl text-xs"
                      />
                      {deliveryLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeliveryLinks((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1.5 rounded-full bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 py-2.5 rounded-full bg-[#F6F8F3] border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBill || isUploadingFile}
                  className="px-6 py-2.5 rounded-full bg-[#0F2A1D] hover:bg-[#375534] text-white text-xs font-extrabold inline-flex items-center gap-2"
                >
                  {isCreatingBill ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuat Tagihan...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 text-[#E3EED4]" />
                      <span>Buat Tagihan &amp; Ambil Kode</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Daftar Semua Tagihan Layanan Kustom */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
            <h3 className="text-base font-extrabold text-[#0F2A1D]">
              Daftar Tagihan Layanan Kustom ({customOrders.length})
            </h3>

            {customOrders.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="text-xs sm:text-sm font-bold text-[#6B9071]">
                  Belum ada tagihan layanan kustom.
                </p>
                <p className="text-xs text-[#6B9071]">
                  Klik tombol <strong>+ Buat Tagihan Kustom Baru</strong> di
                  kanan atas setelah sepakat harga dengan klien di chat.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {customOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/70 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-0.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold">
                            {ord.order_code}
                          </span>
                          <span
                            className={
                              ord.status === 'LUNAS'
                                ? 'px-2.5 py-0.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] border border-[#375534] text-[11px] font-extrabold'
                                : 'px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold'
                            }
                          >
                            {ord.status === 'LUNAS'
                              ? '✅ LUNAS'
                              : '⏳ MENUNGGU BAYAR QRIS'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm sm:text-base text-[#0F2A1D] mt-1">
                          {ord.project_title}
                        </h4>
                        <p className="text-xs text-[#375534]">
                          Klien: <strong>{ord.customer_name}</strong>
                          {ord.customer_email ? ` (${ord.customer_email})` : ''} •{' '}
                          <strong className="text-[#0F2A1D]">
                            Rp{ord.price.toLocaleString('id-ID')}
                          </strong>
                        </p>
                        <p className="text-[11px] text-[#6B9071] mt-0.5">
                          Lampiran: {(ord.file_paths || []).length} File &amp;{' '}
                          {(ord.delivery_links || []).length} Link Akses
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              buildReadyShareMessage(ord),
                              `share-${ord.id}`
                            )
                          }
                          className="px-3.5 py-2 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          {copiedId === `share-${ord.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Salin Pesan Tagihan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(ord)}
                          className="px-3.5 py-2 rounded-full bg-white border border-[#AEC3B0] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {ord.status !== 'LUNAS' && (
                          <button
                            type="button"
                            disabled={busyItemId === `paid-${ord.id}`}
                            onClick={() => handleMarkOrderPaidManual(ord)}
                            className="px-3.5 py-2 rounded-full bg-[#E3EED4] hover:bg-[#375534] text-[#0F2A1D] hover:text-white border border-[#375534] text-xs font-extrabold inline-flex items-center gap-1"
                          >
                            {busyItemId === `paid-${ord.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Tandai Lunas</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busyItemId === `del-${ord.id}`}
                          onClick={() => handleDeleteCustomOrder(ord)}
                          className="p-2 rounded-full bg-red-50 text-red-600"
                          title="Hapus Tagihan"
                        >
                          {busyItemId === `del-${ord.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: KOTAK MASUK KLAIM GARANSI & PERTANYAAN */}
      {/* ==================================================================== */}
      {subTab === 'INBOX_MESSAGES' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#AEC3B0]/60 rf-card-shadow space-y-4">
          <h3 className="text-base font-extrabold text-[#0F2A1D]">
            Kotak Masuk Klaim Garansi &amp; Pertanyaan ({messages.length})
          </h3>

          {messages.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#6B9071] text-center py-8">
              Belum ada klaim garansi atau pertanyaan masuk.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/70 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          msg.type === 'KLAIM_GARANSI'
                            ? 'px-3 py-0.5 rounded-full bg-[#375534] text-white text-[11px] font-extrabold'
                            : 'px-3 py-0.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-[11px] font-extrabold'
                        }
                      >
                        {msg.type === 'KLAIM_GARANSI'
                          ? '🛡️ KLAIM GARANSI'
                          : '💬 PERTANYAAN'}
                      </span>
                      <span className="font-extrabold text-sm text-[#0F2A1D]">
                        {msg.sender_name}
                      </span>
                      <span className="text-xs text-[#6B9071]">
                        ({msg.sender_email})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyItemId === `msg-${msg.id}`}
                        onClick={() => handleToggleMessageStatus(msg)}
                        className={
                          msg.status === 'SELESAI'
                            ? 'px-3.5 py-1.5 rounded-full bg-[#E3EED4] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1'
                            : 'px-3.5 py-1.5 rounded-full bg-white border border-[#375534] text-[#0F2A1D] text-xs font-extrabold inline-flex items-center gap-1'
                        }
                      >
                        {busyItemId === `msg-${msg.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {msg.status === 'SELESAI'
                            ? 'Selesai'
                            : 'Tandai Selesai'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={busyItemId === `delmsg-${msg.id}`}
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-2 rounded-full bg-red-50 text-red-600"
                      >
                        {busyItemId === `delmsg-${msg.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-[#375534] space-y-1">
                    {msg.sender_contact && (
                      <p>
                        <strong>Kontak WA/Tele:</strong> {msg.sender_contact}
                      </p>
                    )}
                    {msg.invoice_number && (
                      <p>
                        <strong>Invoice / Kode:</strong> {msg.invoice_number}
                      </p>
                    )}
                    <p className="p-3 rounded-xl bg-white border border-[#AEC3B0]/50 text-[#0F2A1D] whitespace-pre-line">
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL EDIT TAGIHAN KUSTOM */}
      {/* ==================================================================== */}
      {editingOrder && (
        <div
          onClick={() => !isSavingEdit && setEditingOrder(null)}
          className="fixed inset-0 z-50 bg-[#0F2A1D]/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveEditOrder}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#F6F8F3] w-full max-w-lg rounded-[28px] p-6 shadow-2xl border border-[#AEC3B0] max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#AEC3B0]/50 pb-3">
              <h3 className="font-extrabold text-base text-[#0F2A1D]">
                Edit Tagihan {editingOrder.order_code}
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="w-8 h-8 rounded-full bg-white text-[#0F2A1D] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                Harga Tagihan (Rp) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#AEC3B0] rounded-xl text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F2A1D] mb-1">
                Catatan untuk Pelanggan
              </label>
              <textarea
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#AEC3B0] rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#AEC3B0]/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0F2A1D]">
                  File Produk Kustom
                </span>
                <label className="px-3 py-1.5 rounded-full bg-[#0F2A1D] text-[#E3EED4] text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                  {isUploadingEditFile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tambah File</span>
                    </>
                  )}
                  <input
                    type="file"
                    multiple
                    disabled={isUploadingEditFile}
                    onChange={(e) =>
                      handleUploadCustomFiles(e.target.files, 'edit')
                    }
                    className="hidden"
                  />
                </label>
              </div>

              {editFiles.map((fp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#F6F8F3] text-xs"
                >
                  <span className="truncate">{fp.split('/').pop()}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="pt-2 border-t border-[#AEC3B0]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0F2A1D]">
                    Link Akses Produk
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditLinks((prev) => [...prev, ''])}
                    className="text-[11px] font-bold text-[#375534]"
                  >
                    + Tambah Link
                  </button>
                </div>
                {editLinks.map((lnk, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={lnk}
                      onChange={(e) =>
                        setEditLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? e.target.value : item
                          )
                        )
                      }
                      placeholder="https://..."
                      className="flex-1 px-3 py-1.5 bg-[#F6F8F3] border border-[#AEC3B0] rounded-lg text-xs"
                    />
                    {editLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditLinks((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 rounded-full bg-white border border-[#AEC3B0] text-xs font-extrabold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || isUploadingEditFile}
                className="px-5 py-2.5 rounded-full bg-[#0F2A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#E3EED4]" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}