import 'server-only';

const baseStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
`;

export function buildEmailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;box-shadow:0 4px 6px -1px rgba(0,0,0,0.03);">

              <!-- Header -->
              <tr>
                <td style="background-color:#ffffff;border-radius:12px 12px 0 0;padding:32px 36px 24px 36px;border-bottom:2px solid #4f46e5;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:2px;color:#4f46e5;text-transform:uppercase;">Al Maraghi Motors</p>
                        <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;">Muhimmak</h1>
                        <p style="margin:4px 0 0 0;font-size:13px;font-weight:500;color:#64748b;">مُهِمَّك — You Matter</p>
                      </td>
                      <td align="right" valign="top">
                        <div style="width:44px;height:44px;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:50%;display:inline-block;line-height:44px;text-align:center;">
                          <span style="font-size:18px;color:#4f46e5;">⚙</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background-color:#ffffff;padding:32px 36px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8fafc;border-radius:0 0 12px 12px;padding:24px 36px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px 0;font-size:12px;font-weight:500;color:#64748b;text-align:center;">
                    Muhimmak Feedback System &nbsp;·&nbsp; Al Maraghi Motors &nbsp;·&nbsp; UAE
                  </p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
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
      row.highlight === 'red' ? '#dc2626' :
      row.highlight === 'green' ? '#16a34a' :
      '#0f172a';
    return `
      <tr>
        <td style="padding:12px 0;font-size:13px;font-weight:500;color:#64748b;border-bottom:1px solid #f1f5f9;width:50%;">${row.label}</td>
        <td style="padding:12px 0;font-size:13px;font-weight:600;color:${valueColor};border-bottom:1px solid #f1f5f9;text-align:right;">${row.value}</td>
      </tr>
    `;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #f1f5f9;">
      ${rowsHtml}
    </table>
  `;
}

function buildNarrativeBlock(narrativeHtml: string): string {
  return `
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #4f46e5;border-radius:6px;padding:18px 20px;margin:24px 0;">
      <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#4f46e5;text-transform:uppercase;">AI Analysis</p>
      <div style="font-size:14px;color:#334155;line-height:1.7;">${narrativeHtml}</div>
    </div>
  `;
}

function buildAlertBadge(score: number, threshold: number): string {
  const severity = score < threshold * 0.5 ? 'Critical' : score < threshold * 0.75 ? 'Warning' : 'Alert';
  const bgColor = score < threshold * 0.5 ? '#fef2f2' : score < threshold * 0.75 ? '#fffbebf' : '#fff7ed';
  const borderColor = score < threshold * 0.5 ? '#fecaca' : score < threshold * 0.75 ? '#fde68a' : '#ffedd5';
  const textColor = score < threshold * 0.5 ? '#dc2626' : score < threshold * 0.75 ? '#d97706' : '#ea580c';

  return `
    <div style="display:inline-block;background-color:${bgColor};border:1px solid ${borderColor};border-radius:6px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:12px;font-weight:700;color:${textColor};letter-spacing:1px;text-transform:uppercase;">${severity}</span>
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
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">Low Satisfaction ${severity}</h2>
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
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">Daily Summary</h2>
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
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">Weekly Summary</h2>
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
  isManualReset?: boolean;
}): { subject: string; html: string } {
  const imageTag = data.qrCid
    ? `<div style="text-align:center;margin:24px 0;"><img src="cid:${data.qrCid}" alt="Daily Feedback QR Code" style="width:220px;height:220px;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;padding:12px;display:inline-block;" /></div>`
    : '';

  const titleText = data.isManualReset ? "Updated Feedback QR Code (Manual Reset)" : "Today's Feedback QR Code";
  const subjectTag = data.isManualReset ? "[Muhimmak] Daily QR Feedback Link (Manual Reset)" : "[Muhimmak] Daily QR Feedback Link";

  const content = `
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">${titleText}</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">${data.dateLabel}</p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
      ${data.isManualReset
        ? 'The daily QR code for customer feedback has been manually reset by an administrator. Please use the updated QR code below.'
        : 'Here is the updated daily QR code for customer feedback. Please display or present this QR code to customers today.'}
    </p>

    ${imageTag}

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;word-break:break-all;">
      <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:1px;">Direct Link</p>
      <a href="${data.feedbackUrl}" target="_blank" style="font-size:14px;color:#2563eb;text-decoration:underline;font-weight:500;">${data.feedbackUrl}</a>
    </div>
  `;

  return {
    subject: `${subjectTag} — ${data.dateLabel}`,
    html: buildEmailWrapper(content),
  };
}


