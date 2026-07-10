'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Lock, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface StaffDirectoryEntry {
  id: string;
  full_name: string;
  role: 'staff' | 'super_admin';
}

interface LoginFormProps {
  initialStaff: StaffDirectoryEntry[];
}

export function LoginForm({ initialStaff }: LoginFormProps) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(initialStaff[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePinChange = (value: string) => {
    // Digits only, max 4 chars.
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!profileId) {
      setError('Select who you are.');
      return;
    }
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, pin }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.');
        setPin('');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
          <ClipboardCheck className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Muhimmak</h2>
        <p className="text-sm font-medium text-slate-500">Sign in with your staff PIN</p>
      </div>

      <Card className="border border-slate-200/80 shadow-xl">
        <CardHeader className="pb-4 border-b border-slate-100">
          <CardTitle className="text-lg">Staff Sign In</CardTitle>
          <CardDescription>Select your name and enter your PIN</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="profile" className="text-xs font-semibold text-slate-700">
                Your Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <select
                  id="profile"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="flex h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent transition-all duration-200 shadow-sm"
                  required
                >
                  {initialStaff.length === 0 && <option value="">No staff provisioned yet</option>}
                  {initialStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="pin" className="text-xs font-semibold text-slate-700">
                PIN
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="pl-10 tracking-[0.5em] text-center font-semibold"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading || !initialStaff.length}>
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
