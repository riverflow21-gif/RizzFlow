import React from 'react';
import { supabase } from '@/lib/supabase';
import StorefrontClient from '@/components/storefront/StorefrontClient';
import { Category, Product, StoreSettings } from '@/types';

// Memastikan Vercel selalu menampilkan produk terbaru secara real-time tanpa cache lama
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StorefrontHomePage() {
  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ]);

  const defaultSettings: StoreSettings = {
    id: 1,
    store_name: 'RizzFlow',
    banner_description:
      'Solusi Produk Digital Instan, Praktis, dan Berkualitas. Dapatkan berbagai koleksi e-book, dokumen, template, hingga karya digital pilihan dengan pengiriman otomatis detik itu juga.',
    support_contact: 'rizzflow10@gmail.com',
    updated_at: new Date().toISOString(),
  };

  const settings = (settingsRes.data as StoreSettings | null) || defaultSettings;
  const categories = (categoriesRes.data as Category[] | null) || [];
  const products = (productsRes.data as Product[] | null) || [];

  return (
    <StorefrontClient
      initialProducts={products}
      categories={categories}
      settings={settings}
    />
  );
}