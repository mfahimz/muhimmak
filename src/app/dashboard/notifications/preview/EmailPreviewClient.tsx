'use client';
import React from 'react';
import { Mail, AlertTriangle, BarChart2, Calendar } from 'lucide-react';

type EmailType = 'low_satisfaction_alert' | 'daily_summary' | 'weekly_summary';

const TABS: { type: EmailType; label: string; icon: React.ReactNode }[] = [
  { type: 'low_satisfaction_alert', label: 'Low Satisfaction Alert', icon: <AlertTriangle className="size-4" /> },
  { type: 'daily_summary', label: 'Daily Summary', icon: <BarChart2 className="size-4" /> },
  { type: 'weekly_summary', label: 'Weekly Summary', icon: <Calendar className="size-4" /> },
];

export default function EmailPreviewClient() {
  const [activeType, setActiveType] = React.useState<EmailType>('low_satisfaction_alert');
  const [subject, setSubject] = React.useState<string>('');
  const [html, setHtml] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/notifications/preview?type=${activeType}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSubject(data.subject);
        setHtml(data.html);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeType]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="size-5 text-indigo-600" />
          <h1 className="text-xl font-semibold text-slate-900">Email Template Preview</h1>
        </div>
        <p className="text-sm text-slate-500">
          Preview how notification emails will look when sent. Uses sample data.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveType(tab.type)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeType === tab.type
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subject line */}
      {!loading && !error && subject && (
        <div className="mb-4 flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 shrink-0">Subject</span>
          <span className="text-sm text-slate-700">{subject}</span>
        </div>
      )}

      {/* Preview iframe */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {loading && (
          <div className="flex items-center justify-center h-96 text-slate-400 text-sm">
            Loading preview...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-96 text-rose-500 text-sm">
            Failed to load preview: {error}
          </div>
        )}
        {!loading && !error && html && (
          <iframe
            srcDoc={html}
            className="w-full border-0"
            style={{ height: '700px' }}
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        This is a preview using sample data. Actual emails will contain real session data and AI-generated content.
      </p>
    </div>
  );
}
