'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsesTable } from '@/components/dashboard/ResponsesTable';
import { Form, FormField, FormResponse } from '@/lib/types';

interface ViewResponsesPageProps {
  params: Promise<{ id: string }>;
}

export default function ViewResponsesPage({ params }: ViewResponsesPageProps) {
  const resolvedParams = use(params);
  const formId = resolvedParams.id;

  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock database search
    const mockFormsList: Record<string, { title: string; fields: FormField[]; mockResps: FormResponse[] }> = {
      'express-service': {
        title: 'Express Service Feedback',
        fields: [
          { id: 'q1', type: 'emoji', label: 'Overall Service Satisfaction', required: true },
          { id: 'q2', type: 'rating', label: 'Service Quality Rating', required: true },
          { id: 'q3', type: 'text', label: 'Any additional comments or suggestions?', required: false },
        ],
        mockResps: [
          {
            id: 'r1',
            formId: 'express-service',
            answers: { q1: 5, q2: 5, q3: 'Quick service, happy with the overall work done.' },
            createdAt: '2026-06-08T10:30:00Z',
          },
          {
            id: 'r2',
            formId: 'express-service',
            answers: { q1: 4, q2: 4, q3: 'No issues. Satisfied.' },
            createdAt: '2026-06-08T09:15:00Z',
          },
          {
            id: 'r3',
            formId: 'express-service',
            answers: { q1: 2, q2: 3, q3: 'The wash took too long after servicing was finished.' },
            createdAt: '2026-06-07T15:20:00Z',
          },
          {
            id: 'r4',
            formId: 'express-service',
            answers: { q1: 5, q2: 5, q3: 'Exceptional service!' },
            createdAt: '2026-06-07T11:00:00Z',
          },
        ],
      },
      'showroom': {
        title: 'Showroom Visit Survey',
        fields: [
          { id: 'q1', type: 'emoji', label: 'Consultation Rating', required: true },
          { id: 'q2', type: 'text', label: 'Consultant Name', required: false },
        ],
        mockResps: [
          {
            id: 'sr1',
            formId: 'showroom',
            answers: { q1: 5, q2: 'Ali Al-Maraghi' },
            createdAt: '2026-06-08T08:00:00Z',
          },
          {
            id: 'sr2',
            formId: 'showroom',
            answers: { q1: 4, q2: 'Saeed' },
            createdAt: '2026-06-06T14:45:00Z',
          },
        ],
      },
      'waiting-lounge': {
        title: 'Lounge Comfort Survey',
        fields: [
          { id: 'q1', type: 'rating', label: 'Waiting Lounge Cleanliness', required: true },
          { id: 'q2', type: 'text', label: 'Lounge suggestions', required: false },
        ],
        mockResps: [
          {
            id: 'wl1',
            formId: 'waiting-lounge',
            answers: { q1: 5, q2: 'Everything was clean and coffee was hot.' },
            createdAt: '2026-06-08T11:10:00Z',
          },
          {
            id: 'wl2',
            formId: 'waiting-lounge',
            answers: { q1: 3, q2: 'TV volume was too low.' },
            createdAt: '2026-06-07T16:30:00Z',
          },
        ],
      },
    };

    const foundData = mockFormsList[formId];
    if (foundData) {
      setForm({
        id: formId,
        title: foundData.title,
        fields: foundData.fields,
        isPublished: true,
        createdBy: 'admin_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setResponses(foundData.mockResps);
    }
    setLoading(false);
  }, [formId]);

  const handleExport = () => {
    alert('Exporting responses to CSV (Mock)...');
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-slate-500 font-medium">
        Loading responses...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4 text-center py-16">
        <h3 className="text-xl font-bold text-slate-900">Form Not Found</h3>
        <p className="text-slate-500 text-sm">Cannot view responses for a non-existent form.</p>
        <Link href="/forms">
          <Button>Back to Forms</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link href="/forms">
            <Button variant="ghost" size="sm" className="-ml-3 gap-1.5 text-slate-500 hover:text-slate-900 cursor-pointer">
              <ArrowLeft className="h-4 w-4" /> Back to Forms
            </Button>
          </Link>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Responses: {form.title}</h2>
          <p className="text-sm font-medium text-slate-500">
            Analyze customer responses and feedback comments collected on-site.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5 text-slate-600 bg-white" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button className="gap-1.5" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Main Responses Table */}
      <div className="pt-2">
        <ResponsesTable fields={form.fields} responses={responses} />
      </div>
    </div>
  );
}
