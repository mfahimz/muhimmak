import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm',
          {
            'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500 border border-indigo-700/10': variant === 'primary',
            'bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400': variant === 'secondary',
            'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400': variant === 'outline',
            'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 shadow-none': variant === 'ghost',
            'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 border border-rose-700/10': variant === 'danger',
          },
          {
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-5 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
