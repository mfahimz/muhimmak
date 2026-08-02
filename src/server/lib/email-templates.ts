import 'server-only';

const baseStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  </style>
`;

function buildEmailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);border-radius:12px 12px 0 0;padding:32px 36px;border-bottom:1px solid #4f46e5;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;letter-spacing:3px;color:#818cf8;text-transform:uppercase;">Al Maraghi Motors</p>
                        <h1 style="margin:0;font-size:24px;font-weight:600;color:#f1f5f9;letter-spacing:-0.5px;">Muhimmak</h1>
                        <p style="margin:6px 0 0 0;font-size:13px;color:#94a3b8;">مُهِمَّك — You Matter</p>
                      </td>
                      <td align="right">
                        <div style="width:44px;height:44px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:50%;display:inline-block;line-height:44px;text-align:center;">
                          <span style="font-size:20px;">⚙</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#1e293b;padding:32px 36px;border-left:1px solid #334155;border-right:1px solid #334155;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#0f172a;border-radius:0 0 12px 12px;padding:20px 36px;border:1px solid #1e293b;border-top:none;">
                  <p style="margin:0;font-size:11px;color:#475569;text-align:center;">
                    Muhimmak Feedback System &nbsp;·&nbsp; Al Maraghi Motors &nbsp;·&nbsp; UAE
                  </p>
                  <p style="margin:6px 0 0 0;font-size:11px;color:#334155;text-align:center;">
                    This is an automated notification. Do not reply to this email.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function buildDataTable(rows: { label: string; value: string; highlight?: 'red' | 'green' | 'normal' }[]): string {
  const rowsHtml = rows.map(row => {
    const valueColor =
      row.highlight === 'red' ? '#f87171' :
      row.highlight === 'green' ? '#34d399' :
      '#e2e8f0';
    return `
      <tr>
        <td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #1e293b;width:50%;">${row.label}</td>
        <td style="padding:12px 0;font-size:13px;font-weight:500;color:${valueColor};border-bottom:1px solid #1e293b;text-align:right;">${row.value}</td>
      </tr>
    `;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${rowsHtml}
    </table>
  `;
}

function buildNarrativeBlock(narrativeHtml: string): string {
  return `
    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 6px 0;font-size:10px;font-weight:600;letter-spacing:2px;color:#818cf8;text-transform:uppercase;">AI Analysis</p>
      <div style="font-size:14px;color:#cbd5e1;line-height:1.7;">${narrativeHtml}</div>
    </div>
  `;
}

function buildAlertBadge(score: number, threshold: number): string {
  const severity = score < threshold * 0.5 ? 'Critical' : score < threshold * 0.75 ? 'Warning' : 'Alert';
  const color = score < threshold * 0.5 ? '#ef4444' : score < threshold * 0.75 ? '#f59e0b' : '#f97316';
  return `
    <div style="display:inline-block;background:${color}22;border:1px solid ${color}66;border-radius:6px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:12px;font-weight:600;color:${color};letter-spacing:1px;text-transform:uppercase;">${severity}</span>
    </div>
  `;
}

export function lowSatisfactionAlertEmail(data: {
  sessionId: string;
  score: number;
  threshold: number;
  formName: string;
  date: string;
  narrativeHtml: string;
}): { subject: string; html: string } {
  const severity = data.score < data.threshold * 0.5 ? 'Critical' : 'Alert';
  const content = `
    ${buildAlertBadge(data.score, data.threshold)}
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Low Satisfaction ${severity}</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">A session score fell below your alert threshold.</p>

    ${buildNarrativeBlock(data.narrativeHtml)}

    ${buildDataTable([
      { label: 'Score', value: `${data.score}%`, highlight: 'red' },
      { label: 'Alert Threshold', value: `${data.threshold}%`, highlight: 'normal' },
      { label: 'Form', value: data.formName, highlight: 'normal' },
      { label: 'Date', value: data.date, highlight: 'normal' },
      { label: 'Session ID', value: data.sessionId, highlight: 'normal' },
    ])}
  `;
  return {
    subject: `[Muhimmak] ⚠ Low Satisfaction ${severity} — Score ${data.score}%`,
    html: buildEmailWrapper(content),
  };
}

export function dailySummaryEmail(data: {
  date: string;
  totalSessions: number;
  completedSessions: number;
  averageScore: number | null;
  lowScoreCount: number;
  narrativeHtml: string;
}): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Daily Summary</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">${data.date}</p>

    ${buildNarrativeBlock(data.narrativeHtml)}

    ${buildDataTable([
      { label: 'Total Sessions', value: String(data.totalSessions), highlight: 'normal' },
      { label: 'Completed', value: String(data.completedSessions), highlight: 'normal' },
      { label: 'Average Score', value: data.averageScore !== null ? `${data.averageScore}%` : 'N/A', highlight: data.averageScore !== null && data.averageScore >= 70 ? 'green' : 'red' },
      { label: 'Low Score Alerts', value: String(data.lowScoreCount), highlight: data.lowScoreCount > 0 ? 'red' : 'green' },
    ])}
  `;
  return {
    subject: `[Muhimmak] Daily Summary — ${data.date}`,
    html: buildEmailWrapper(content),
  };
}

export function weeklySummaryEmail(data: {
  weekStart: string;
  weekEnd: string;
  totalSessions: number;
  completedSessions: number;
  averageScore: number | null;
  lowScoreCount: number;
  narrativeHtml: string;
}): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Weekly Summary</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">${data.weekStart} — ${data.weekEnd}</p>

    ${buildNarrativeBlock(data.narrativeHtml)}

    ${buildDataTable([
      { label: 'Total Sessions', value: String(data.totalSessions), highlight: 'normal' },
      { label: 'Completed', value: String(data.completedSessions), highlight: 'normal' },
      { label: 'Average Score', value: data.averageScore !== null ? `${data.averageScore}%` : 'N/A', highlight: data.averageScore !== null && data.averageScore >= 70 ? 'green' : 'red' },
      { label: 'Low Score Alerts', value: String(data.lowScoreCount), highlight: data.lowScoreCount > 0 ? 'red' : 'green' },
    ])}
  `;
  return {
    subject: `[Muhimmak] Weekly Summary — ${data.weekStart} to ${data.weekEnd}`,
    html: buildEmailWrapper(content),
  };
}

export function dailyQrEmail(data: {
  feedbackUrl: string;
  dateLabel: string;
  qrCid?: string;
}): { subject: string; html: string } {
  const imageTag = data.qrCid
    ? `<div style="text-align:center;margin:24px 0;"><img src="cid:${data.qrCid}" alt="Daily Feedback QR Code" style="width:220px;height:220px;border-radius:16px;border:4px solid #334155;background:#ffffff;padding:12px;display:inline-block;" /></div>`
    : '';

  const content = `
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Today's Feedback QR Code</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#94a3b8;">${data.dateLabel}</p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;line-height:1.6;">
      Here is the updated daily QR code for customer feedback. Please display or present this QR code to customers today.
    </p>

    ${imageTag}

    <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;margin:20px 0;text-align:center;word-break:break-all;">
      <p style="margin:0 0 8px 0;font-size:11px;font-weight:600;color:#818cf8;text-transform:uppercase;letter-spacing:1px;">Direct Link</p>
      <a href="${data.feedbackUrl}" target="_blank" style="font-size:14px;color:#38bdf8;text-decoration:underline;">${data.feedbackUrl}</a>
    </div>
  `;

  return {
    subject: `[Muhimmak] Daily QR Feedback Link — ${data.dateLabel}`,
    html: buildEmailWrapper(content),
  };
}

