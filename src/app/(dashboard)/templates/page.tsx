'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TemplateItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fieldsCount: number;
  featured?: boolean;
}

export default function TemplatesPage() {
  const router = useRouter();

  const templates: TemplateItem[] = [
    {
      id: 'express-service',
      title: 'Express Service Satisfaction',
      description: 'Collect immediate feedback at vehicle delivery bays regarding speed, wash quality, and consultation.',
      category: 'Service Center',
      fieldsCount: 4,
      featured: true,
    },
    {
      id: 'showroom-visit',
      title: 'Showroom Consultation Survey',
      description: 'Assess customer experience during new car viewings, test drives, and interactions with sales advisors.',
      category: 'Showroom',
      fieldsCount: 5,
      featured: true,
    },
    {
      id: 'lounge-feedback',
      title: 'Waiting Lounge Comfort Audit',
      description: 'Monitor quality scores of refreshments, seating layout, wifi connectivity, and cleanliness of client spaces.',
      category: 'Hospitality',
      fieldsCount: 3,
    },
    {
      id: 'parts-delivery',
      title: 'Spare Parts Counter Feedback',
      description: 'Short survey checking parts availability, staff knowledge, and check-out speed at sales counters.',
      category: 'Parts Center',
      fieldsCount: 4,
    },
    {
      id: 'complimentary-wash',
      title: 'Car Detailing & Wash Check',
      description: 'Check cleaning thoroughness, exterior shine, and interior vacuum quality after vehicle service runs.',
      category: 'Wash Bay',
      fieldsCount: 3,
    },
  ];

  const handleUseTemplate = (templateId: string) => {
    alert(`Initializing form builder with '${templateId}' template! (Mock)`);
    router.push(`/forms/new?template=${templateId}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Form Templates</h2>
        <p className="text-sm font-medium text-slate-500">
          Kickstart your customer surveys with pre-designed templates optimized for automotive feedback
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`flex flex-col justify-between border ${
              template.featured
                ? 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-300'
                : 'border-slate-200/80 hover:border-slate-350'
            } transition-all relative overflow-hidden`}
          >
            {template.featured && (
              <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Recommended
              </span>
            )}
            <CardHeader className="pb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {template.category}
              </span>
              <CardTitle className="text-lg mt-1 text-slate-800 leading-snug">{template.title}</CardTitle>
              <CardDescription className="text-sm text-slate-500 mt-2 leading-relaxed">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <CheckCircle2 className="h-4.5 w-4.5 text-slate-400" />
                <span>Includes {template.fieldsCount} pre-configured questions</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-slate-50/50 mt-4 bg-slate-50/10 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between group cursor-pointer bg-white"
                onClick={() => handleUseTemplate(template.id)}
              >
                <span>Use Template</span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
