'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  userEmail?: string;
  userRole?: string;
}

export function Sidebar({
  userEmail = 'admin@almaraghi.com',
  userRole = 'Super Admin',
}: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  const menuItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Forms', href: '/forms', icon: FileText },
    { name: 'Templates', href: '/templates', icon: Layers },
    { name: 'Manage Users', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile top navigation bar */}
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-indigo-400" />
          <span className="font-bold text-sm tracking-wider uppercase">Al Maraghi</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar navigation drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-100 transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
          <ClipboardCheck className="h-7 w-7 text-indigo-400" />
          <div>
            <h1 className="text-md font-bold leading-none tracking-wide text-white uppercase">Al Maraghi</h1>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider">FEEDBACK PORTAL</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 px-4 py-6">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
                onClick={() => setIsOpen(false)}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-slate-400')} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-850 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-350">
              <User className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-bold text-slate-200">{userEmail}</p>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{userRole}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="mt-3 w-full justify-start gap-3 text-slate-400 hover:bg-slate-800 hover:text-rose-400 text-xs px-4"
            onClick={() => {
              alert('Logging out (Mock)...');
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Overlay backdrop for mobile when open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}
    </>
  );
}
