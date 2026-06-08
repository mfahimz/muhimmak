import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  description,
  trend,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md border border-slate-100', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          {icon && <div className="text-slate-400 p-2 bg-slate-50 rounded-lg">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                {
                  'bg-emerald-50 text-emerald-700': trend.type === 'positive',
                  'bg-rose-50 text-rose-700': trend.type === 'negative',
                  'bg-slate-100 text-slate-700': trend.type === 'neutral',
                }
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-xs text-slate-400 font-medium">{description}</p>}
      </CardContent>
    </Card>
  );
}
