-- ============================================================================
-- RIZZFLOW DATABASE & STORAGE SCHEMA (SIAP COPY-PASTE KE SUPABASE SQL EDITOR)
-- ============================================================================

-- Aktifkan ekstensi pembuat ID unik otomatis (UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL PENGATURAN TOKO (store_settings)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'RizzFlow',
  banner_description TEXT NOT NULL DEFAULT 'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.',
  support_contact TEXT NOT NULL DEFAULT 'support@rizzflow.com',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Masukkan pengaturan toko awal
INSERT INTO public.store_settings (id, store_name, banner_description, support_contact)
VALUES (1, 'RizzFlow', 'Temukan template Excel, PPT, dan aset desain siap pakai untuk mempercepat produktivitasmu.', 'support@rizzflow.com')
ON CONFLICT (id) DO NOTHING;

-- 2. TABEL KATEGORI PRODUK (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Masukkan kategori contoh awal
INSERT INTO public.categories (name, slug) VALUES
  ('Template Excel', 'template-excel'),
  ('Template PPT', 'template-ppt'),
  ('Aset Desain', 'aset-desain')
ON CONFLICT (slug) DO NOTHING;

-- 3. TABEL PRODUK DIGITAL (products)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  thumbnail_url TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Lokasi file asli di dalam private bucket 'digital-products'
  badge TEXT,              -- Opsional: 'Terlaris', 'Baru', dll.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL KODE PROMO (promo_codes)
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,               -- Contoh: HEMAT20
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_discount_amount INTEGER NOT NULL CHECK (max_discount_amount >= 0), -- Maksimal potongan dalam Rupiah
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL PESANAN PELANGGAN (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount INTEGER NOT NULL CHECK (final_amount >= 0),
  promo_code_used TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'EXPIRED')),
  qris_string TEXT,                        -- String QRIS dari DOKU untuk dirender menjadi gambar QR
  qris_expires_at TIMESTAMPTZ NOT NULL,    -- Batas waktu kedaluwarsa 1 jam (60 menit)
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL RINCIAN ITEM PESANAN (order_items)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- ============================================================================
-- PENGATURAN KEAMANAN DATABASE (ROW LEVEL SECURITY / RLS)
-- ============================================================================

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Pengunjung publik boleh membaca pengaturan toko, kategori, dan produk aktif
CREATE POLICY "Publik bisa membaca pengaturan toko" ON public.store_settings
  FOR SELECT USING (true);

CREATE POLICY "Publik bisa membaca kategori" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Publik bisa membaca produk aktif" ON public.products
  FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');

-- Admin yang sudah login (authenticated) boleh mengelola semua tabel
CREATE POLICY "Admin kelola pengaturan toko" ON public.store_settings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kelola kategori" ON public.categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kelola produk" ON public.products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kelola kode promo" ON public.promo_codes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kelola pesanan" ON public.orders
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kelola item pesanan" ON public.order_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- PEMBUATAN OTOMATIS STORAGE BUCKETS (TEMPAT GAMBAR & FILE PRODUK DIGITAL)
-- ============================================================================

-- 1. Bucket Publik untuk gambar sampul produk (product-thumbnails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-thumbnails', 'product-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Bucket Privat untuk file asli produk digital (digital-products)
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-products', 'digital-products', false)
ON CONFLICT (id) DO NOTHING;

-- Kebijakan akses untuk product-thumbnails (Publik bisa lihat, hanya Admin bisa upload/hapus)
CREATE POLICY "Gambar sampul dapat dilihat publik" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-thumbnails');

CREATE POLICY "Admin dapat unggah gambar sampul" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Admin dapat hapus gambar sampul" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-thumbnails' AND auth.role() = 'authenticated');

-- Kebijakan akses untuk digital-products (Hanya Admin dan Server yang bisa akses)
CREATE POLICY "Admin dapat kelola file produk digital" ON storage.objects
  FOR ALL USING (bucket_id = 'digital-products' AND auth.role() = 'authenticated');