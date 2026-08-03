'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { Shield, Database, Lock, Bot, Share2, Clock, UserCheck, Mail } from 'lucide-react';

export default function PrivacyPage() {
  const tLegal = useTranslations('Legal');
  const tPrivacy = useTranslations('Privacy');

  const sections = [
    {
      icon: Shield,
      title: tPrivacy('introTitle'),
      body: tPrivacy('introBody'),
    },
    {
      icon: Database,
      title: tPrivacy('dataCollectedTitle'),
      body: tPrivacy('dataCollectedBody'),
    },
    {
      icon: UserCheck,
      title: tPrivacy('dataUseTitle'),
      body: tPrivacy('dataUseBody'),
    },
    {
      icon: Lock,
      title: tPrivacy('dataProtectionTitle'),
      body: tPrivacy('dataProtectionBody'),
    },
    {
      icon: Bot,
      title: tPrivacy('aiPrivacyTitle'),
      body: tPrivacy('aiPrivacyBody'),
    },
    {
      icon: Share2,
      title: tPrivacy('dataSharingTitle'),
      body: tPrivacy('dataSharingBody'),
    },
    {
      icon: Clock,
      title: tPrivacy('dataRetentionTitle'),
      body: tPrivacy('dataRetentionBody'),
    },
    {
      icon: UserCheck,
      title: tPrivacy('rightsTitle'),
      body: tPrivacy('rightsBody'),
    },
    {
      icon: Mail,
      title: tPrivacy('contactTitle'),
      body: tPrivacy('contactBody'),
    },
  ];

  return (
    <LegalLayout activeTab="privacy">
      <div className="space-y-8">
        {/* Document Header Hero */}
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 sm:p-10 shadow-2xl overflow-hidden">
          <div className="absolute -right-12 -top-12 size-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Shield className="size-3.5" />
              <span>{tLegal('privacyPolicy')}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {tPrivacy('pageTitle')}
            </h1>

            <p className="text-slate-300 text-base max-w-3xl leading-relaxed">
              {tPrivacy('subtitle')}
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
                  <div className="space-y-2 flex-1">
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
