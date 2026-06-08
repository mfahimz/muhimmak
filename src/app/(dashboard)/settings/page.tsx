'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, UserPlus, Trash2, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'super_admin';
  createdAt: string;
}

export default function SettingsPage() {
  const [currentRole, setCurrentRole] = useState<string>('super_admin');
  const [users, setUsers] = useState<StaffUser[]>([
    { id: '1', name: 'Ali Al-Maraghi', email: 'ali@almaraghi.com', role: 'super_admin', createdAt: '2026-01-15T08:00:00Z' },
    { id: '2', name: 'Fahim Zafar', email: 'fahim@almaraghi.com', role: 'super_admin', createdAt: '2026-03-20T10:15:00Z' },
    { id: '3', name: 'John Doe', email: 'john@almaraghi.com', role: 'staff', createdAt: '2026-05-12T14:30:00Z' },
    { id: '4', name: 'Sarah Smith', email: 'sarah@almaraghi.com', role: 'staff', createdAt: '2026-06-02T09:00:00Z' },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'super_admin'>('staff');

  useEffect(() => {
    // Read local storage mockup
    const savedRole = localStorage.getItem('mock_user_role') || 'super_admin';
    setCurrentRole(savedRole);
  }, []);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) {
      alert('Please fill out all fields.');
      return;
    }
    const newUser: StaffUser = {
      id: String(Date.now()),
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      createdAt: new Date().toISOString(),
    };
    setUsers([...users, newUser]);
    setInviteEmail('');
    setInviteName('');
    alert(`Invitation sent to ${inviteEmail} (Mock)!`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      setUsers(users.filter((u) => u.id !== id));
    }
  };

  // ROLE-BASED PROTECTION PREVIEW
  if (currentRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-4xl">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-extrabold text-slate-900">Access Denied</h3>
        <p className="text-slate-500 text-sm leading-relaxed">
          You are currently logged in as a <strong>Staff/Admin</strong>. Only accounts with <strong>Super Admin</strong> authorization are permitted to manage user accounts.
        </p>
        <div className="pt-2">
          <p className="text-xs text-slate-400 italic">
            To view this page, log out and sign in using the "Super Admin" role selector.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">User Management</h2>
        <p className="text-sm font-medium text-slate-500">
          Manage staff access roles and invite team members to review customer feedback
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Team Members List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-lg">Active Team Members ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                        {user.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{user.name}</p>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                              user.role === 'super_admin'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/20'
                                : 'bg-slate-50 text-slate-700 border-slate-200/20'
                            }`}
                          >
                            {user.role === 'super_admin' ? 'Super Admin' : 'Staff'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xxs text-slate-400 font-semibold uppercase">
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                      {user.email !== 'ali@almaraghi.com' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invite New User */}
        <div>
          <Card className="border border-indigo-100/50 bg-indigo-50/5/10">
            <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" /> Invite Team Member
              </CardTitle>
              <CardDescription>Invite members to access feedback portals</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="e.g. Ahmed Ali"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="pl-9 bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="name@almaraghi.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9 bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Access Role</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setInviteRole('staff')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        inviteRole === 'staff'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Staff / Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole('super_admin')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        inviteRole === 'super_admin'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Super Admin
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full mt-2">
                  Send Invitation
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
