'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ArrowLeft } from 'lucide-react';
import { FormPreview } from '@/components/forms/FormPreview';
import { Button } from '@/components/ui/button';
import { FormField } from '@/lib/types';

interface PublicFormPageProps {
  params: Promise<{ id: string }>;
}

export default function PublicFormPage({ params }: PublicFormPageProps) {
  const resolvedParams = use(params);
  const formId = resolvedParams.id;

  const [formData, setFormData] = useState<{ title: string; description: string; fields: FormField[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock database lookup for form configuration by URL parameter
    const mockFormsList: Record<string, { title: string; description: string; fields: FormField[] }> = {
      'express-service': {
        title: 'Express Service Feedback',
        description: 'Thank you for choosing Al Maraghi. Please take a moment to rate our speed and quality of work.',
        fields: [
          { id: 'q1', type: 'emoji', label: 'How satisfied are you with the overall service speed?', required: true },
          { id: 'q2', type: 'rating', label: 'Rate the friendliness of our service advisors', required: true },
          { id: 'q3', type: 'rating', label: 'Rate the cleanliness and delivery of your vehicle', required: true },
          { id: 'q4', type: 'textarea', label: 'Do you have any comments for improvement?', required: false },
        ],
      },
      'showroom': {
        title: 'Showroom Consultation Survey',
        description: 'We hope you enjoyed your consultation. Please share your rating of our sales experience.',
        fields: [
          { id: 'q1', type: 'emoji', label: 'Overall showroom experience rating', required: true },
          { id: 'q2', type: 'rating', label: 'How informative was your sales representative?', required: true },
          { id: 'q3', type: 'radio', label: 'Were you offered a test drive today?', required: true, options: [
            { label: 'Yes, and I completed one', value: 'yes' },
            { label: 'Yes, but I declined', value: 'declined' },
            { label: 'No, but I would like to schedule one', value: 'schedule' },
            { label: 'No, it was not offered', value: 'no' }
          ]},
          { id: 'q4', type: 'textarea', label: 'What did you like best about your visit?', required: false },
        ],
      },
      'waiting-lounge': {
        title: 'Lounge Comfort Survey',
        description: 'Help us maintain premium comfort levels in our lounge spaces.',
        fields: [
          { id: 'q1', type: 'rating', label: 'Lounge Cleanliness & Seating Comfort', required: true },
          { id: 'q2', type: 'radio', label: 'How was the quality of refreshments served?', required: false, options: [
            { label: 'Excellent', value: 'excellent' },
            { label: 'Good', value: 'good' },
            { label: 'Needs Improvement', value: 'needs_improvement' }
          ]},
          { id: 'q3', type: 'textarea', label: 'Any specific requests for lounge amenities?', required: false },
        ],
      },
    };

    // If ID doesn't match predefined mocks, fallback to a generic questionnaire
    const foundForm = mockFormsList[formId] || {
      title: 'Customer Feedback Survey',
      description: 'Your feedback helps us deliver exceptional experiences at Al Maraghi.',
      fields: [
        { id: 'g1', type: 'emoji', label: 'Rate your overall satisfaction today', required: true },
        { id: 'g2', type: 'rating', label: 'Rate our staff helpfulness', required: true },
        { id: 'g3', type: 'textarea', label: 'Please share your comments', required: false },
      ],
    };

    setFormData(foundForm);
    setLoading(false);
  }, [formId]);

  const handleSubmitResponse = (answers: Record<string, any>) => {
    // Mock response submission logger
    console.log(`Submitted response for form '${formId}':`, answers);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-semibold">
        Loading customer feedback screen...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Premium Public Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-md font-extrabold text-slate-900 tracking-wide uppercase leading-none">Al Maraghi</h1>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Customer Care Portal</span>
          </div>
        </div>
        <div>
          {/* Back to dashboard quick link for preview/scaffolding demo */}
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" /> Exit Form
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Form Center Layout */}
      <main className="flex-1 px-4 py-8 overflow-y-auto">
        {formData && (
          <FormPreview
            title={formData.title}
            description={formData.description}
            fields={formData.fields}
            onSubmit={handleSubmitResponse}
            isTabletView={true}
          />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="bg-white border-t border-slate-150 py-3 text-center text-slate-400 text-xxs font-semibold tracking-wider">
        AL MARAGHI AUTO SERVICE CENTRE © {new Date().getFullYear()} — POWERED BY AL MARAGHI FEEDBACK SYSTEM
      </footer>
    </div>
  );
}
