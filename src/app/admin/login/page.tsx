'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/admin');
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session) {
        throw new Error(
          error?.message || 'Email atau password salah. Pastikan akun sudah dibuat di Supabase Auth.'
        );
      }

      router.replace('/admin');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal masuk ke dashboard admin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Lihat Toko</span>
          </Link>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669]">
            Panel Pemilik Toko
          </span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.jpg"
            alt="RizzFlow Logo"
            className="h-11 w-auto rounded-xl object-contain shadow-xs"
          />
          <div>
            <h1 className="text-xl font-extrabold text-[#0F172A]">
              Login Admin RizzFlow
            </h1>
            <p className="text-xs text-[#64748B]">
              Masuk untuk mengatur produk, kode promo, dan pesanan.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Email Admin
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rizzflow10@gmail.com"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#10B981] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#10B981] focus:bg-white"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#EF4444] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:bg-emerald-300 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <span>Masuk ke Admin Dashboard</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}