import type { RenderedEmail } from '../events.js';

/*
 * Email shell: cream paper, cocoa text, a kraft rule, one rose-free button. Deliberately light: table layout
 * with inline styles (email clients), no images, system font stack. Colours mirror web/src/app/globals.css.
 */
const C = { cream: '#f6eee3', paper: '#fcf8f2', cocoa: '#3f2619', brown: '#6b4228', kraft: '#d4ae80', line: '#e8d3b4' };

export interface EmailContent {
  subject: string;
  /** Hidden inbox preview text. */
  preheader?: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: string;
  brandName: string;
  supportLine?: string;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const formatRupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function renderEmail(c: EmailContent): RenderedEmail {
  const paragraphs = c.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.cocoa};">${escapeHtml(p)}</p>`).join('');
  const button = c.cta
    ? `<p style="margin:24px 0 8px;"><a href="${escapeHtml(c.cta.url)}" style="display:inline-block;background:${C.cocoa};color:${C.paper};text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:999px;">${escapeHtml(c.cta.label)}</a></p>`
    : '';
  const foot = c.footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${C.brown};">${escapeHtml(c.footnote)}</p>` : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(c.preheader ?? '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.paper};border:1px solid ${C.line};border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font-family:'Arial Rounded MT Bold',ui-rounded,Arial,sans-serif;font-size:20px;color:${C.brown};border-bottom:2px dashed ${C.kraft};">${escapeHtml(c.brandName)}</td></tr>
<tr><td style="padding:24px 28px 28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.cocoa};">${escapeHtml(c.heading)}</h1>
${paragraphs}${button}${foot}
</td></tr>
<tr><td style="padding:0 28px 24px;font-family:system-ui,Arial,sans-serif;font-size:12px;color:${C.brown};">Crocheted by hand, one piece at a time.${c.supportLine ? ` ${escapeHtml(c.supportLine)}` : ''}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [c.heading, '', ...c.paragraphs.flatMap((p) => [p, '']), ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ''] : []), ...(c.footnote ? [c.footnote, ''] : []), `${c.brandName} - crocheted by hand, one piece at a time.`].join('\n');
  return { subject: c.subject, html, text };
}
