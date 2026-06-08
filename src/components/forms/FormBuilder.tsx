'use client';

import React, { useState } from 'react';
import { FormField, FormFieldType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField as FormFieldComponent } from './FormField';

interface FormBuilderProps {
  initialTitle?: string;
  initialDescription?: string;
  initialFields?: FormField[];
  onSave?: (data: { title: string; description: string; fields: FormField[] }) => void;
}

export function FormBuilder({
  initialTitle = '',
  initialDescription = '',
  initialFields = [],
  onSave,
}: FormBuilderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<FormField[]>(initialFields);

  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Question`,
      required: false,
      placeholder: type === 'text' || type === 'textarea' ? 'Enter your response...' : undefined,
      options: ['select', 'radio', 'checkbox'].includes(type)
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : undefined,
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((field) => field.id !== id));
  };

  const updateField = (id: string, updatedField: Partial<FormField>) => {
    setFields(
      fields.map((field) => (field.id === id ? { ...field, ...updatedField } as FormField : field))
    );
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ title, description, fields });
    } else {
      alert('Form saved successfully (Mock)!');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Editor panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Form Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Form Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Customer Satisfaction Survey"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell customers the purpose of this feedback..."
                className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'rating', 'emoji'] as FormFieldType[]).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addField(type)}
                  className="capitalize justify-start text-xs h-9"
                >
                  + {type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {fields.length > 0 && (
          <div className="flex justify-end gap-3">
            <Button variant="outline">Discard Changes</Button>
            <Button onClick={handleSave}>Save Form</Button>
          </div>
        )}
      </div>

      {/* Form Fields & Live Layout List */}
      <div className="space-y-6">
        <Card className="min-h-[400px]">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Form Elements ({fields.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {fields.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                <p>No questions added yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use the panel on the left to add fields.</p>
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Question #{index + 1} — {field.type}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 -my-1.5"
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Enter the question text"
                      className="bg-white font-medium"
                    />

                    {['text', 'textarea'].includes(field.type) && (
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="Placeholder text (optional)"
                        className="bg-white text-xs h-9"
                      />
                    )}

                    {['select', 'radio', 'checkbox'].includes(field.type) && field.options && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Options</label>
                        {field.options.map((option, oIdx) => (
                          <div key={oIdx} className="flex gap-2 items-center">
                            <Input
                              value={option.label}
                              onChange={(e) => {
                                const newOpts = [...(field.options || [])];
                                newOpts[oIdx] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                updateField(field.id, { options: newOpts });
                              }}
                              placeholder={`Option ${oIdx + 1}`}
                              className="bg-white h-8 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500"
                              onClick={() => {
                                const newOpts = (field.options || []).filter((_, idx) => idx !== oIdx);
                                updateField(field.id, { options: newOpts });
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            const newOpts = [...(field.options || []), { label: `New Option`, value: `new_option_${Date.now()}` }];
                            updateField(field.id, { options: newOpts });
                          }}
                        >
                          + Add Option
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`req-${field.id}`}
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <label htmlFor={`req-${field.id}`} className="text-xs text-slate-600 font-medium cursor-pointer">
                        This is a required question
                      </label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
