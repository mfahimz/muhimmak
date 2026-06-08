'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Users,
  MessageSquareCheck,
  Star,
  Plus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ResponsesTable } from '@/components/dashboard/ResponsesTable';
import { FormField, FormResponse } from '@/lib/types';

export default function DashboardOverviewPage() {
  // Mock fields for the recent responses preview
  const mockFields: FormField[] = [
    { id: 'q1', type: 'emoji', label: 'Overall Satisfaction', required: true },
    { id: 'q2', type: 'rating', label: 'Staff Friendliness', required: true },
    { id: 'q3', type: 'text', label: 'Comments', required: false },
  ];

  // Mock responses data
  const mockResponses: FormResponse[] = [
    {
      id: 'resp_1',
      formId: 'form_1',
      answers: { q1: 5, q2: 5, q3: 'Exceptional customer service from Fahim at the desk!' },
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    },
    {
      id: 'resp_2',
      formId: 'form_1',
      answers: { q1: 4, q2: 4, q3: 'Quick service, happy with the overall work done on my vehicle.' },
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hrs ago
    },
    {
      id: 'resp_3',
      formId: 'form_2',
      answers: { q1: 3, q2: 4, q3: 'Waiting room was a bit crowded, but the feedback tablet worked great.' },
      createdAt: new Date(Date.now() - 1000 * 60 * 400).toISOString(), // 6.5 hrs ago
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-sm font-medium text-slate-500">
            Real-time analytics and customer feedback overview
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/templates">
            <Button variant="outline">Browse Templates</Button>
          </Link>
          <Link href="/forms/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Form
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Forms"
          value={8}
          icon={<FileText className="h-5 w-5 text-indigo-500" />}
          description="Forms created by staff"
          trend={{ value: '+2 this month', type: 'positive' }}
        />
        <StatsCard
          title="Active Tablets"
          value={5}
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          description="Tablet devices online"
          trend={{ value: 'All Active', type: 'positive' }}
        />
        <StatsCard
          title="Total Responses"
          value={412}
          icon={<MessageSquareCheck className="h-5 w-5 text-indigo-500" />}
          description="Submissions collected"
          trend={{ value: '+48 today', type: 'positive' }}
        />
        <StatsCard
          title="Avg. Rating"
          value="4.7 / 5"
          icon={<Star className="h-5 w-5 text-amber-500" />}
          description="Customer satisfaction score"
          trend={{ value: '+0.2% change', type: 'positive' }}
        />
      </div>

      {/* Analytics chart and quick links placeholder */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Satisfaction Trend</CardTitle>
                <CardDescription>Average weekly ratings tracker</CardDescription>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <TrendingUp className="h-3.5 w-3.5" /> High Satisfaction
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center border-t border-slate-50">
            {/* Elegant visual placeholder for chart */}
            <div className="w-full h-full flex items-end justify-between px-6 pt-8 pb-4 relative">
              {/* grid lines */}
              <div className="absolute inset-x-6 top-12 border-t border-slate-100 border-dashed w-calc-full" />
              <div className="absolute inset-x-6 top-24 border-t border-slate-100 border-dashed w-calc-full" />
              <div className="absolute inset-x-6 top-36 border-t border-slate-100 border-dashed w-calc-full" />

              {/* columns */}
              {[4.2, 4.4, 4.3, 4.6, 4.5, 4.7].map((score, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 z-10 w-full">
                  <span className="text-xxs font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{score}</span>
                  <div
                    style={{ height: `${(score / 5) * 140}px` }}
                    className="w-8 sm:w-12 rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-600 transition-all duration-500 hover:from-indigo-600 hover:to-indigo-700 cursor-pointer"
                  />
                  <span className="text-xxs text-slate-400 font-medium">Week {idx + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Forms Quick-Links</CardTitle>
            <CardDescription>Share or view tablet forms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { id: 'express-service', title: 'Express Service Feedback', responseCount: 184 },
              { id: 'showroom', title: 'Showroom Visit Survey', responseCount: 92 },
              { id: 'waiting-lounge', title: 'Lounge Comfort Survey', responseCount: 136 },
            ].map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-indigo-100 transition-colors"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[170px]">{form.title}</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">{form.responseCount} responses</p>
                </div>
                <div className="flex gap-1.5">
                  <Link href={`/form/${form.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer">
                      Tablet Link
                    </Button>
                  </Link>
                  <Link href={`/forms/${form.id}/responses`}>
                    <Button size="sm" className="h-7 text-xs px-2 cursor-pointer">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            <Link href="/forms" className="block text-center pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                View all forms <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Responses Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent Customer Responses</h3>
            <p className="text-xs text-slate-400">Latest feedback submissions across active tablets</p>
          </div>
          <Link href="/forms">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
              Go to forms responses <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <ResponsesTable fields={mockFields} responses={mockResponses} />
      </div>
    </div>
  );
}
