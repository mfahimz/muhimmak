'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { Button } from '@/components/ui/button';
import { Form, FormField } from '@/lib/types';

interface EditFormPageProps {
  params: Promise<{ id: string }>;
}

export default function EditFormPage({ params }: EditFormPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const formId = resolvedParams.id;
  
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock database search for the form by ID
  useEffect(() => {
    const mockFormsList: Record<string, { title: string; description: string; fields: FormField[] }> = {
      'express-service': {
        title: 'Express Service Feedback',
        description: 'Quick survey for vehicle servicing customers at the quick bays.',
        fields: [
          { id: 'q1', type: 'emoji', label: 'Overall Service Satisfaction', required: true },
          { id: 'q2', type: 'rating', label: 'Service Quality Rating', required: true },
          { id: 'q3', type: 'textarea', label: 'Any additional comments or suggestions?', required: false },
        ],
      },
      'showroom': {
        title: 'Showroom Visit Survey',
        description: 'Collect feedback on customer experience with our sales consultants.',
        fields: [
          { id: 'q1', type: 'emoji', label: 'Consultation Rating', required: true },
          { id: 'q2', type: 'radio', label: 'Did you purchase a vehicle today?', required: true, options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No, just browsing', value: 'no' }
          ]},
        ],
      },
      'waiting-lounge': {
        title: 'Lounge Comfort Survey',
        description: 'Ask customers about refreshments, seating, and entertainment in the waiting area.',
        fields: [
          { id: 'q1', type: 'rating', label: 'Waiting Lounge Cleanliness', required: true },
          { id: 'q2', type: 'checkbox', label: 'Which amenities did you use?', required: false, options: [
            { label: 'WiFi', value: 'wifi' },
            { label: 'Coffee/Tea Station', value: 'coffee' },
            { label: 'TV/Magazines', value: 'tv' }
          ]},
        ],
      },
    };

    const foundForm = mockFormsList[formId];
    if (foundForm) {
      setForm({
        id: formId,
        title: foundForm.title,
        description: foundForm.description,
        fields: foundForm.fields,
        isPublished: true,
        createdBy: 'admin_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [formId]);

  const handleSave = (data: { title: string; description: string; fields: FormField[] }) => {
    // Mock save logic
    console.log(`Saved form ${formId} data:`, data);
    alert('Form updated successfully (Mock)!');
    router.push('/forms');
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-slate-500 font-medium">
        Loading form editor...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4 text-center py-16">
        <h3 className="text-xl font-bold text-slate-900">Form Not Found</h3>
        <p className="text-slate-500 text-sm">The form you are trying to edit does not exist or has been deleted.</p>
        <Link href="/forms">
          <Button>Back to Forms</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col gap-2">
        <Link href="/forms">
          <Button variant="ghost" size="sm" className="-ml-3 gap-1.5 text-slate-500 hover:text-slate-900 cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Forms
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Edit Form: {form.title}</h2>
          <p className="text-sm font-medium text-slate-500">
            Modify question settings, options, or layout structure. Updates will reflect on active tablets immediately.
          </p>
        </div>
      </div>

      {/* Form Editor */}
      <div className="pt-2">
        <FormBuilder
          initialTitle={form.title}
          initialDescription={form.description}
          initialFields={form.fields}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
