'use client';

import React from 'react';
import { FormField as FormFieldType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  field: FormFieldType;
  value: any;
  onChange: (val: any) => void;
  error?: string;
  disabled?: boolean;
}

export function FormField({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: FormFieldProps) {
  const { id, type, label, placeholder, required, options } = field;

  const handleRatingClick = (rating: number) => {
    if (disabled) return;
    onChange(rating);
  };

  const emojis = [
    { emoji: '😠', label: 'Angry', value: 1 },
    { emoji: '🙁', label: 'Sad', value: 2 },
    { emoji: '😐', label: 'Neutral', value: 3 },
    { emoji: '🙂', label: 'Happy', value: 4 },
    { emoji: '😍', label: 'Excellent', value: 5 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-base font-semibold text-slate-800">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      </div>

      {/* Render input based on field type */}
      {type === 'text' && (
        <Input
          id={id}
          placeholder={placeholder || 'Enter text...'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(error && 'border-rose-300 focus-visible:ring-rose-500')}
        />
      )}

      {type === 'textarea' && (
        <textarea
          id={id}
          placeholder={placeholder || 'Enter your feedback here...'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] shadow-sm',
            error && 'border-rose-300 focus-visible:ring-rose-500'
          )}
        />
      )}

      {type === 'number' && (
        <Input
          id={id}
          type="number"
          placeholder={placeholder || '0'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(error && 'border-rose-300 focus-visible:ring-rose-500')}
        />
      )}

      {type === 'select' && (
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm',
            error && 'border-rose-300 focus-visible:ring-rose-500'
          )}
        >
          <option value="">Select an option...</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === 'radio' && (
        <div className="space-y-2 pt-1">
          {options?.map((opt) => (
            <div key={opt.value} className="flex items-center gap-3">
              <input
                type="radio"
                id={`${id}-${opt.value}`}
                name={id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label
                htmlFor={`${id}-${opt.value}`}
                className="text-sm text-slate-700 cursor-pointer font-medium"
              >
                {opt.label}
              </label>
            </div>
          ))}
        </div>
      )}

      {type === 'checkbox' && (
        <div className="space-y-2 pt-1">
          {options?.map((opt) => {
            const currentVals = Array.isArray(value) ? value : [];
            const isChecked = currentVals.includes(opt.value);
            const handleCheckboxChange = () => {
              if (disabled) return;
              if (isChecked) {
                onChange(currentVals.filter((v) => v !== opt.value));
              } else {
                onChange([...currentVals, opt.value]);
              }
            };

            return (
              <div key={opt.value} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`${id}-${opt.value}`}
                  checked={isChecked}
                  onChange={handleCheckboxChange}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label
                  htmlFor={`${id}-${opt.value}`}
                  className="text-sm text-slate-700 cursor-pointer font-medium"
                >
                  {opt.label}
                </label>
              </div>
            );
          })}
        </div>
      )}

      {type === 'rating' && (
        <div className="flex items-center gap-2 pt-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = (value || 0) >= star;
            return (
              <button
                key={star}
                type="button"
                disabled={disabled}
                onClick={() => handleRatingClick(star)}
                className={cn(
                  'text-3xl transition-transform duration-100 focus:outline-none cursor-pointer',
                  isFilled ? 'text-amber-400' : 'text-slate-200',
                  !disabled && 'hover:scale-110 active:scale-95'
                )}
              >
                ★
              </button>
            );
          })}
        </div>
      )}

      {type === 'emoji' && (
        <div className="flex items-center gap-4 pt-2">
          {emojis.map((item) => {
            const isSelected = value === item.value;
            return (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => handleRatingClick(item.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2 rounded-xl border border-transparent transition-all cursor-pointer focus:outline-none',
                  isSelected
                    ? 'bg-indigo-50 border-indigo-150 scale-105'
                    : 'hover:bg-slate-50',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className={cn('text-3xl transition-transform', isSelected ? 'scale-110' : 'grayscale-25 hover:grayscale-0')}>{item.emoji}</span>
                <span className={cn('text-xxs font-bold uppercase tracking-wider', isSelected ? 'text-indigo-600' : 'text-slate-400')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs font-semibold text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
