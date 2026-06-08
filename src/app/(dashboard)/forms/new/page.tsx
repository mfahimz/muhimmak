'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { Button } from '@/components/ui/button';

export default function NewFormPage() {
  const router = useRouter();

  const handleSave = (data: { title: string; description: string; fields: any[] }) => {
    // Mock save logic
    console.log('Saved new form data:', data);
    alert('Form created successfully (Mock)!');
    router.push('/forms');
  };

  return (
    <div className="space-y-6">
      {/* Navigation and Title Header */}
      <div className="flex flex-col gap-2">
        <Link href="/forms">
          <Button variant="ghost" size="sm" className="-ml-3 gap-1.5 text-slate-500 hover:text-slate-900 cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Forms
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Create Feedback Form</h2>
          <p className="text-sm font-medium text-slate-500">
            Define your feedback questions, ratings, and choices for customer response screens.
          </p>
        </div>
      </div>

      {/* Main FormBuilder Workspace */}
      <div className="pt-2">
        <FormBuilder onSave={handleSave} />
      </div>
    </div>
  );
}
