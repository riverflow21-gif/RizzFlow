'use client';

import React, { useState } from 'react';
import {
  Plus,
  FolderTree,
  X,
  Link as LinkIcon,
  Trash2,
  Loader2,
  Upload,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  supabase,
  parseThumbnails,
  parseProductDeliverables,
} from '@/lib/supabase';
import { Product, Category } from '@/types';
import { ADMIN_LOGO_PATH } from './AdminTypes';

interface AdminCatalogTabProps {
  products: Product[];
  categories: Category[];
  onRefreshData: () => Promise<void>;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
}

type CatalogActionPanel = 'NONE' | 'ADD_PRODUCT' | 'MANAGE_CATEGORIES';
type NullableProduct = Product | null;

export default function AdminCatalogTab({
  products,
  categories,
  onRefreshData,
  onShowFeedback,
}: AdminCatalogTabProps) {
  const [catalogPanel, setCatalogPanel] = useState(
    'NONE' as CatalogActionPanel
  );
  const [editingProduct, setEditingProduct] = useState(
    null as NullableProduct
  );
  const [adminProductSearch, setAdminProductSearch] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('ALL');

  // State Form Produk
  const [prodTitle, setProdTitle] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(
    categories[0]?.id || ''
  );
  const [prodPrice, setProdPrice] = useState('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState('');
  const [prodBadge, setProdBadge] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [thumbnailFiles, setThumbnailFiles] = useState([] as File[]);
  const [digitalFiles, setDigitalFiles] = useState([] as File[]);
  const [productLinks, setProductLinks] = useState([''] as string[]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // State Form Kategori
  const [catName, setCatName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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

  const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = productLinks
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const existingDeliverables = editingProduct
      ? parseProductDeliverables(editingProduct.file_path)
      : null;

    if (!editingProduct && thumbnailFiles.length === 0) {
      onShowFeedback(
        'error',
        'Harap pilih minimal 1 Gambar Sampul (Thumbnail).'
      );
      return;
    }

    const hasExistingFiles =
      existingDeliverables && existingDeliverables.files.length > 0;

    if (
      digitalFiles.length === 0 &&
      !hasExistingFiles &&
      validLinks.length === 0
    ) {
      onShowFeedback(
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
        onShowFeedback('success', 'Perubahan produk berhasil disimpan!');
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
        onShowFeedback('success', 'Produk baru berhasil diterbitkan!');
      }

      handleCancelEditProduct();
      await onRefreshData();
    } catch (err) {
      onShowFeedback(
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
      await onRefreshData();
      onShowFeedback('success', 'Status tampilan produk diperbarui.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);
    if (!error) {
      await onRefreshData();
      onShowFeedback('success', 'Produk berhasil dihapus dari katalog.');
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
      await onRefreshData();
      onShowFeedback('success', 'Kategori baru berhasil ditambahkan!');
    } catch (err) {
      onShowFeedback(
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
      await onRefreshData();
      onShowFeedback('success', 'Kategori berhasil dihapus.');
    }
  };

  return (
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
                prev === 'MANAGE_CATEGORIES' ? 'NONE' : 'MANAGE_CATEGORIES'
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

      {/* PANEL 1: FORM TAMBAH / EDIT PRODUK */}
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

          <form onSubmit={handleCreateOrUpdateProduct} className="space-y-4">
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
                      onChange={(e) => handleUpdateLinkRow(idx, e.target.value)}
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

      {/* PANEL 2: FORM TAMBAH & KELOLA KATEGORI */}
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
                const deliverables = parseProductDeliverables(prod.file_path);

                return (
                  <div
                    key={prod.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#F6F8F3] border border-[#AEC3B0]/50 min-w-0"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <img
                        src={thumbs[0] || ADMIN_LOGO_PATH}
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
  );
}