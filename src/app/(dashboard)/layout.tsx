'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userEmail, setUserEmail] = useState('admin@almaraghi.com');
  const [userRole, setUserRole] = useState('Super Admin');

  useEffect(() => {
    // Load mock user session if set
    const savedRole = localStorage.getItem('mock_user_role');
    const savedEmail = localStorage.getItem('mock_user_email');
    
    if (savedEmail) setUserEmail(savedEmail);
    if (savedRole) {
      setUserRole(savedRole === 'super_admin' ? 'Super Admin' : 'Staff / Admin');
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Dashboard sidebar navigation */}
      <Sidebar userEmail={userEmail} userRole={userRole} />

      {/* Main dashboard content container */}
      <main className="flex flex-1 flex-col overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
