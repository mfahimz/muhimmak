'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Lock, Mail, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'super_admin'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    // Mock Login implementation: wait 1s and redirect to dashboard
    setTimeout(() => {
      setLoading(false);
      // Save mock login session to local storage for local presentation
      localStorage.setItem('mock_user_role', role);
      localStorage.setItem('mock_user_email', email);
      router.push('/dashboard');
    }, 1000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Al Maraghi Feedback</h2>
          <p className="text-sm font-medium text-slate-500">Sign in to manage forms and view responses</p>
        </div>

        <Card className="border border-slate-200/80 shadow-xl">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-lg">Staff Sign In</CardTitle>
            <CardDescription>Enter your credential details below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                  {error}
                </div>
              )}

              {/* Role Picker for Demo/Scaffolding */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Demo User Role</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRole('staff')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      role === 'staff'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Staff/Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('super_admin')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      role === 'super_admin'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Super Admin
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@almaraghi.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="remember" className="text-slate-600 font-medium cursor-pointer">
                    Remember me
                  </label>
                </div>
                <a href="#" className="font-semibold text-indigo-600 hover:text-indigo-500">
                  Forgot password?
                </a>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo instructions */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <div className="flex gap-2">
            <Shield className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Scaffolding Demo Info</p>
              <p className="mt-1">
                Enter any email and password to log in. You can choose a role above to customize the dashboard view permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
