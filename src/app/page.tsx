import React from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  LayoutDashboard,
  Tablet,
  ArrowRight,
  ShieldCheck,
  Users,
  Compass,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Navbar Header */}
      <nav className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-md font-extrabold text-slate-900 tracking-wide uppercase leading-none">Al Maraghi</h1>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Scaffolding Preview Hub</span>
          </div>
        </div>
        <div>
          <Link href="/login">
            <Button size="sm" className="gap-1.5 font-bold cursor-pointer">
              Go to Portal <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main content Hero section */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-full uppercase tracking-wider">
            Scaffold Complete
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            Al Maraghi Feedback Portal
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            A customer feedback application built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase database and authentication.
          </p>
        </div>

        {/* Roles Section */}
        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="border border-slate-200/80 bg-white">
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">1. Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unauthenticated tablet users. Submit feedback responses on tablet displays placed at quick-service delivery desks and lounge areas.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 bg-white">
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Compass className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">2. Staff / Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Authenticated form creators. Create and configure questionnaires using the interactive FormBuilder editor, and audit customer responses.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 bg-white">
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">3. Super Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Platform manager privileges. Invite new staff accounts, delegate user-role authorization permissions, and delete profiles.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scaffolding Navigation Hub Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Admin panel navigation link card */}
          <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutDashboard className="h-5 w-5 text-indigo-600" /> Staff & Admin Portal
              </CardTitle>
              <CardDescription>Manage forms, responses, templates, and staff profiles</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                {[
                  { name: 'Dashboard Overview', href: '/dashboard' },
                  { name: 'My Forms List', href: '/forms' },
                  { name: 'Create Form Builder', href: '/forms/new' },
                  { name: 'Form Templates Library', href: '/templates' },
                  { name: 'User Access / Settings', href: '/settings' },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between text-sm text-slate-600 hover:text-indigo-600 font-semibold p-2 hover:bg-slate-50 rounded-lg transition-all">
                    <span>{link.name}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
              <Link href="/login" className="block pt-2">
                <Button className="w-full">Sign In to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Customer tablet links */}
          <Card className="border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tablet className="h-5 w-5 text-indigo-600" /> Public Customer Surveys
              </CardTitle>
              <CardDescription>Tablet layouts optimized for on-site customer response</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                {[
                  { id: 'express-service', label: 'Express Service Feedback Screen' },
                  { id: 'showroom', label: 'Showroom Visit Survey Screen' },
                  { id: 'waiting-lounge', label: 'Waiting Lounge Comfort Survey' },
                ].map((item) => (
                  <Link key={item.id} href={`/form/${item.id}`} className="flex items-center justify-between text-sm text-slate-600 hover:text-indigo-600 font-semibold p-2.5 hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                    <span>{item.label}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Open Form
                    </span>
                  </Link>
                ))}
              </div>
              <div className="text-center text-xs text-slate-400 italic pt-1">
                Note: Tablet forms are unauthenticated public pages designed for kiosk displays.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-semibold tracking-wider">
        AL MARAGHI AUTO SERVICE CENTRE © {new Date().getFullYear()} — SCAFFOLDING PORTAL
      </footer>
    </div>
  );
}
