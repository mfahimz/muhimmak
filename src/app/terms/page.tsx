'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { FileText, ShieldCheck, UserCheck, Bot, Scale, AlertTriangle, Building2 } from 'lucide-react';

export default function TermsPage() {
  const tLegal = useTranslations('Legal');
  const tTerms = useTranslations('Terms');

  const sections = [
    {
      icon: ShieldCheck,
      title: tTerms('introTitle'),
      body: tTerms('introBody'),
    },
    {
      icon: Building2,
      title: tTerms('serviceDescriptionTitle'),
      body: tTerms('serviceDescriptionBody'),
    },
    {
      icon: UserCheck,
      title: tTerms('authorizedUseTitle'),
      body: tTerms('authorizedUseBody'),
    },
    {
      icon: FileText,
      title: tTerms('customerConsentTitle'),
      body: tTerms('customerConsentBody'),
    },
    {
      icon: Scale,
      title: tTerms('intellectualPropertyTitle'),
      body: tTerms('intellectualPropertyBody'),
    },
    {
      icon: Bot,
      title: tTerms('aiAnalyticsTitle'),
      body: tTerms('aiAnalyticsBody'),
    },
    {
      icon: AlertTriangle,
      title: tTerms('disclaimerTitle'),
      body: tTerms('disclaimerBody'),
    },
    {
      icon: Scale,
      title: tTerms('limitationLiabilityTitle'),
      body: tTerms('limitationLiabilityBody'),
    },
    {
      icon: FileText,
      title: tTerms('modificationsTitle'),
      body: tTerms('modificationsBody'),
    },
    {
      icon: Building2,
      title: tTerms('governingLawTitle'),
      body: tTerms('governingLawBody'),
    },
  ];

  return (
    <LegalLayout activeTab="terms">
      <div className="space-y-8">
        {/* Document Header Hero */}
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 sm:p-10 shadow-2xl overflow-hidden">
          <div className="absolute -right-12 -top-12 size-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <FileText className="size-3.5" />
              <span>{tLegal('termsOfUse')}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {tTerms('pageTitle')}
            </h1>

            <p className="text-slate-300 text-base max-w-3xl leading-relaxed">
              {tTerms('subtitle')}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400 border-t border-slate-800/80">
              <div>
                <span className="font-semibold text-slate-300">{tLegal('lastUpdated')}: </span>
                <span>{tLegal('effectiveDate')}</span>
              </div>
              <span className="size-1 rounded-full bg-slate-700" />
              <div>
                <span className="font-semibold text-slate-300">Entity: </span>
                <span>{tLegal('companyName')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Sections Grid */}
        <div className="space-y-6">
          {sections.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div
                key={idx}
                className="group rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 p-6 transition-all shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:bg-indigo-500/20 transition-all shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                      {sec.title}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                      {sec.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </LegalLayout>
  );
}
