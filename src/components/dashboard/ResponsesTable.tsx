'use client';

import React from 'react';
import { FormField, FormResponse } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ResponsesTableProps {
  fields: FormField[];
  responses: FormResponse[];
}

export function ResponsesTable({ fields, responses }: ResponsesTableProps) {
  // Truncate long answers for display in table cell
  const renderCellVal = (field: FormField, response: FormResponse) => {
    const val = response.answers[field.id];
    if (val === undefined || val === null) {
      return <span className="text-slate-350">—</span>;
    }

    if (field.type === 'emoji') {
      const emojiMap: Record<number, string> = { 1: '😠', 2: '🙁', 3: '😐', 4: '🙂', 5: '😍' };
      return <span className="text-xl">{emojiMap[val] || val}</span>;
    }

    if (field.type === 'rating') {
      return (
        <span className="text-amber-500 font-semibold flex items-center gap-0.5">
          {val} <span className="text-xs text-amber-400">★</span>
        </span>
      );
    }

    if (Array.isArray(val)) {
      return val.join(', ');
    }

    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }

    const str = String(val);
    return str.length > 50 ? `${str.substring(0, 47)}...` : str;
  };

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white border border-slate-200/80 rounded-xl">
        <p className="font-medium">No responses received yet</p>
        <p className="text-xs mt-1">Share the public form link with customers to collect feedback.</p>
      </div>
    );
  }

  // To avoid extremely wide tables, we show the first 4 fields as columns
  const visibleFields = fields.slice(0, 4);

  return (
    <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-500">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th scope="col" className="px-6 py-4">Submitted At</th>
              {visibleFields.map((field) => (
                <th key={field.id} scope="col" className="px-6 py-4 font-semibold truncate max-w-[200px]">
                  {field.label}
                </th>
              ))}
              {fields.length > 4 && <th scope="col" className="px-6 py-4 font-semibold text-slate-400">Other Fields</th>}
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-solid">
            {responses.map((resp) => (
              <tr key={resp.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                  {formatDate(resp.createdAt)}
                </td>
                {visibleFields.map((field) => (
                  <td key={field.id} className="px-6 py-4 max-w-[250px] truncate text-slate-700">
                    {renderCellVal(field, resp)}
                  </td>
                ))}
                {fields.length > 4 && (
                  <td className="px-6 py-4 text-xs italic text-slate-400">
                    +{fields.length - 4} more answers
                  </td>
                )}
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    onClick={() => alert(`Showing details for response ID: ${resp.id} (Mock)`)}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-3">
        <span className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-700">{responses.length}</span> of{' '}
          <span className="font-bold text-slate-700">{responses.length}</span> responses
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled className="h-8 px-3 text-xs">
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled className="h-8 px-3 text-xs">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
