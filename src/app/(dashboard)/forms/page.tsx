'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  ExternalLink,
  MessageSquare,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MockFormItem {
  id: string;
  title: string;
  description: string;
  status: 'published' | 'draft';
  responseCount: number;
  createdAt: string;
}

export default function FormsListPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const [forms, setForms] = useState<MockFormItem[]>([
    {
      id: 'express-service',
      title: 'Express Service Feedback',
      description: 'Quick survey for vehicle servicing customers at the quick bays.',
      status: 'published',
      responseCount: 184,
      createdAt: '2026-05-10T08:00:00Z',
    },
    {
      id: 'showroom',
      title: 'Showroom Visit Survey',
      description: 'Collect feedback on customer experience with our sales consultants.',
      status: 'published',
      responseCount: 92,
      createdAt: '2026-05-15T09:30:00Z',
    },
    {
      id: 'waiting-lounge',
      title: 'Lounge Comfort Survey',
      description: 'Ask customers about refreshments, seating, and entertainment in the waiting area.',
      status: 'published',
      responseCount: 136,
      createdAt: '2026-05-20T14:15:00Z',
    },
    {
      id: 'car-wash',
      title: 'Car Wash Quality Survey',
      description: 'Inspect satisfaction ratings regarding clean detailing output.',
      status: 'draft',
      responseCount: 0,
      createdAt: '2026-06-01T11:00:00Z',
    },
  ]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this form?')) {
      setForms(forms.filter((form) => form.id !== id));
    }
  };

  const filteredForms = forms.filter((form) => {
    const matchesSearch =
      form.title.toLowerCase().includes(search.toLowerCase()) ||
      form.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' || form.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Feedback Forms</h2>
          <p className="text-sm font-medium text-slate-500">
            Create, publish, and manage customer feedback templates
          </p>
        </div>
        <Link href="/forms/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Create Feedback Form
          </Button>
        </Link>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200/80 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
          <Input
            placeholder="Search forms by title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 shadow-none border-slate-200 focus-visible:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg capitalize border cursor-pointer transition-all',
                filter === type
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Forms Grid */}
      {filteredForms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 bg-white border border-slate-200/80 rounded-xl">
          <FileText className="h-12 w-12 text-slate-300 mb-2" />
          <p className="font-semibold text-sm">No forms found</p>
          <p className="text-xs mt-1 text-slate-400">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredForms.map((form) => (
            <Card
              key={form.id}
              className="overflow-hidden border border-slate-250/50 hover:border-indigo-150 transition-all flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-lg hover:text-indigo-600 transition-colors">
                        <Link href={`/forms/${form.id}`}>{form.title}</Link>
                      </h3>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                          form.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-250/20'
                            : 'bg-amber-50 text-amber-700 border border-amber-250/20'
                        )}
                      >
                        {form.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold">
                      Created on {new Date(form.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="relative group">
                    <button className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {/* Simplified actions overlay trigger placeholder */}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500 line-clamp-2 leading-relaxed">{form.description}</p>
              </div>

              {/* Card Footer Links */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <span>{form.responseCount} Responses</span>
                </div>
                <div className="flex gap-2">
                  {form.status === 'published' && (
                    <Link href={`/form/${form.id}`} target="_blank">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-2 bg-white cursor-pointer">
                        <ExternalLink className="h-3.5 w-3.5" /> Tablet Form
                      </Button>
                    </Link>
                  )}
                  <Link href={`/forms/${form.id}`}>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-2 bg-white cursor-pointer">
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </Link>
                  <Link href={`/forms/${form.id}/responses`}>
                    <Button size="sm" className="h-8 text-xs gap-1.5 px-2.5 cursor-pointer">
                      Responses
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    onClick={() => handleDelete(form.id)}
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
