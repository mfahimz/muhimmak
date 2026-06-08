'use client';

import React, { useState } from 'react';
import { FormField as FormFieldType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormField } from './FormField';

interface FormPreviewProps {
  title: string;
  description?: string;
  fields: FormFieldType[];
  onSubmit?: (answers: Record<string, any>) => void;
  isTabletView?: boolean;
}

export function FormPreview({
  title,
  description,
  fields,
  onSubmit,
  isTabletView = false,
}: FormPreviewProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers({ ...answers, [fieldId]: value });
    if (errors[fieldId]) {
      const newErrors = { ...errors };
      delete newErrors[fieldId];
      setErrors(newErrors);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required) {
        const val = answers[field.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.id] = 'This field is required.';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // scroll to first error
      return;
    }

    setSubmitted(true);
    if (onSubmit) {
      onSubmit(answers);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setErrors({});
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <Card className={isTabletView ? 'max-w-2xl mx-auto my-12' : ''}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-4xl animate-bounce">
            ✓
          </div>
          <CardTitle className="text-2xl text-slate-800">Thank You!</CardTitle>
          <CardDescription className="max-w-md text-sm">
            Your feedback has been successfully submitted. We appreciate your time and comments.
          </CardDescription>
          <Button variant="outline" className="mt-4" onClick={handleReset}>
            Submit another response
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isTabletView ? 'max-w-2xl mx-auto shadow-lg' : ''}>
      <CardHeader className="space-y-2 border-b border-slate-100 pb-6">
        <CardTitle className={isTabletView ? 'text-3xl text-slate-800' : 'text-xl'}>
          {title || 'Untitled Feedback Form'}
        </CardTitle>
        {description && <CardDescription className="text-slate-500">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              This form has no questions yet.
            </div>
          ) : (
            fields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(val) => handleFieldChange(field.id, val)}
                error={errors[field.id]}
              />
            ))
          )}

          {fields.length > 0 && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" size={isTabletView ? 'lg' : 'md'} className="w-full sm:w-auto">
                Submit Feedback
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
