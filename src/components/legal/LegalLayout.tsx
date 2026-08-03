'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LanguageToggle } from '@/components/language-toggle';
import { Printer, Link as LinkIcon, Check, ArrowLeft, Shield, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface LegalLayoutProps {
  activeTab: 'terms' | 'privacy';
  children: React.ReactNode;
}

export function LegalLayout({ activeTab, children }: LegalLayoutProps) {
  const t = useTranslations('Legal');
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Floating Glassmorphism Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand & Logo */}
          <Link href="/login" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center p-1.5 shadow-lg shadow-indigo-500/10 group-hover:border-indigo-400/50 transition-all">
              <Image
                src="/brand/al-maraghi-icon-white.png"
                alt={t('platformName')}
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                {t('platformName')}
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {t('companyName')}
              </span>
            </div>
          </Link>

          {/* Center Document Switcher Tabs */}
          <nav className="hidden md:flex items-center bg-slate-900/90 border border-slate-800 rounded-full p-1 shadow-inner">
            <Link
              href="/terms"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'terms'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileText className="size-3.5" />
              <span>{t('termsOfUse')}</span>
            </Link>
            <Link
              href="/privacy"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'privacy'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="size-3.5" />
              <span>{t('privacyPolicy')}</span>
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            
            <button
              type="button"
              onClick={handlePrint}
              title={t('printPage')}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 hidden sm:flex items-center gap-1.5 text-xs font-medium"
            >
              <Printer className="size-4 text-slate-400" />
              <span className="hidden lg:inline">{t('printPage')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              title={t('copyLink')}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1.5 text-xs font-medium"
            >
              {copied ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <LinkIcon className="size-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">{copied ? t('linkCopied') : t('copyLink')}</span>
            </button>

            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" />
              <span>{t('backToLogin')}</span>
            </Link>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden items-center justify-center gap-2 pt-3 border-t border-slate-800/60 mt-2">
          <Link
            href="/terms"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'terms'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="size-3.5" />
            <span>{t('termsOfUse')}</span>
          </Link>
          <Link
            href="/privacy"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'privacy'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="size-3.5" />
            <span>{t('privacyPolicy')}</span>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-8 text-slate-400 text-xs mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/al-maraghi-icon-white.png"
              alt={t('companyName')}
              width={20}
              height={20}
              className="object-contain opacity-70"
            />
            <span className="font-medium text-slate-300">
              © {new Date().getFullYear()} {t('companyName')}. {t('allRightsReserved')}
            </span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <Link href="/terms" className="hover:text-indigo-400 transition-colors">
              {t('termsOfUse')}
            </Link>
            <span className="size-1 rounded-full bg-slate-700" />
            <Link href="/privacy" className="hover:text-indigo-400 transition-colors">
              {t('privacyPolicy')}
            </Link>
            <span className="size-1 rounded-full bg-slate-700" />
            <Link href="/login" className="hover:text-indigo-400 transition-colors">
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
