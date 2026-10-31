/**
 * Renders Nest coaching mail and checks that a letter is safe to send.
 * Personalization uses a first name and, sometimes, one Inner Compass name.
 * It never reads Journey reflections or unsaved tool answers.
 */

import { CHECKINS, LETTERS, WELCOME } from './nest-letters-copy.js';

export const LETTER_COUNT = LETTERS.length;
export const FROM_ADDRESS = "lil' bird <hello@lilbird.life>";
export const REPLY_TO = 'hello@lilbird.life';
export const NEST_ORIGIN = 'https://lilbird.life';
export const SIGNATURE = 'Luke & the lil\' bird team 🐦';

const FONT_SANS = 'Helvetica,Arial,sans-serif';
const FONT_SERIF = "Georgia,'Times New Roman',serif";

export function toolUrl(toolId) {
  return `${NEST_ORIGIN}/nest/?tool=${encodeURIComponent(toolId)}`;
}

export function canvasUrl() {
  return `${NEST_ORIGIN}/nest/?tab=canvas`;
}

export function preferencesUrl() {
  return `${NEST_ORIGIN}/nest/#email-preferences`;
}

export function preferredFirstName(user) {
  const meta = user?.user_metadata || {};
  const raw = meta.preferred_name || meta.full_name || meta.name || '';
  const first = String(raw).trim().split(/\s+/)[0] || '';
  if (!/^[A-Za-z][A-Za-z'’-]{0,30}$/.test(first)) return '';
  return first;
}

export function greeting(firstName) {
  return firstName ? `Hello ${firstName},` : 'Hello,';
}

/** A short archetype name only. Anything that looks like a paragraph or a score is dropped. */
export function archetypeName(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const raw = profile.likelyCoreArchetypePlain || profile.archetypePlain || '';
  const name = String(raw).replace(/\s+/g, ' ').trim();
  if (!name || name.length > 40) return '';
  if (/[0-9.!?]|attachment|enneagram|mbti|wound|trauma/i.test(name)) return '';
  if (!/^[\p{L}][\p{L}\s'’&-]{1,39}$/u.test(name)) return '';
  return name;
}

export function compassLine(letter, profile) {
  if (typeof letter?.compass !== 'function') return '';
  const name = archetypeName(profile);
  if (!name) return '';
  try {
    const line = String(letter.compass(name) || '').trim();
    return line.length > 320 ? '' : line;
  } catch {
    return '';
  }
}

/** The name object a letter may see. The rest of the assessment stays out. */
export function archetypeProfileForLetter(record, recipientEmail) {
  const name = archetypeName(record);
  if (!name) return null;
  const stored = String(record?.email || '').trim().toLowerCase();
  const recipient = String(recipientEmail || '').trim().toLowerCase();
  if (stored && recipient && stored !== recipient) return null;
  if (record.likelyCoreArchetypePlain) return { likelyCoreArchetypePlain: name };
  return { archetypePlain: name };
}

export function selectLetterProfile(recordsByNestId, nestIds, recipientEmail) {
  for (const nestId of nestIds || []) {
    const profile = archetypeProfileForLetter(recordsByNestId?.[nestId], recipientEmail);
    if (profile) return profile;
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphsFor(note, profile, firstName) {
  const lines = [greeting(firstName), ...note.paragraphs];
  const compass = compassLine(note, profile);
  if (compass) lines.splice(2, 0, compass);
  return lines;
}

function htmlShell({ preheader, kicker, subject, paragraphs, action, unsubUrl, prefsUrl, mailingAddress }) {
  const esc = escapeHtml;
  const body = paragraphs.map((p, i) => {
    const size = i === 0 ? 18 : 17;
    const color = i === 0 ? '#f0ead8' : '#cfc8b6';
    return `<p style="margin:0 0 18px;font-family:${FONT_SANS};font-size:${size}px;line-height:1.7;color:${color};">${esc(p)}</p>`;
  }).join('\n');
  const actionBlock = action
    ? `<tr><td style="padding:8px 8px 8px;">
<p style="margin:0 0 8px;font-family:${FONT_SANS};font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a130;">${esc(action.eyebrow)}</p>
<a href="${esc(action.url)}" style="font-family:${FONT_SERIF};font-size:18px;line-height:1.4;color:#F5C842;text-decoration:underline;">${esc(action.label)}</a>
</td></tr>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#1a1c23;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1c23;">
<tr><td align="center" style="padding:0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:28px 8px 12px;font-family:${FONT_SERIF};font-style:italic;font-size:18px;color:#F5C842;">lil' bird</td></tr>
${kicker ? `<tr><td style="padding:8px 8px 0;font-family:${FONT_SANS};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#c9a130;">${esc(kicker)}</td></tr>` : ''}
<tr><td style="padding:10px 8px 22px;">
${body}
<p style="margin:8px 0 0;font-family:${FONT_SERIF};font-style:italic;font-size:18px;line-height:1.5;color:#F5C842;">${esc(SIGNATURE)}</p>
</td></tr>
${actionBlock}
<tr><td style="padding:28px 8px 40px;font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:#8a8478;">
You are receiving this because you asked for Nest coaching notes. Your Nest stays yours either way.<br>
<a href="${esc(prefsUrl)}" style="color:#c9a130;">Email preferences</a> · <a href="${esc(unsubUrl)}" style="color:#c9a130;">Unsubscribe</a><br>
${esc(mailingAddress || '')}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function textBody({ kicker, paragraphs, action, unsubUrl, prefsUrl, mailingAddress }) {
  const lines = [...(kicker ? [kicker, ''] : []), ...paragraphs.flatMap((p) => [p, '']), SIGNATURE];
  if (action) lines.push('', `${action.label}: ${action.url}`);
  lines.push('', `Email preferences: ${prefsUrl}`, `Unsubscribe: ${unsubUrl}`, mailingAddress || '');
  return lines.join('\n');
}

export function renderNote(note, options = {}) {
  const firstName = options.firstName || '';
  const paragraphs = paragraphsFor(note, options.profile, firstName);
  const action = note.toolId
    ? { eyebrow: 'If you want to go further', label: 'Open this tool in your Nest', url: options.toolUrl || toolUrl(note.toolId) }
    : note.key && String(note.key).startsWith('canvas')
      ? { eyebrow: 'Your Life Canvas', label: 'Open Life Canvas', url: options.canvasUrl || canvasUrl() }
      : { eyebrow: 'Your Nest', label: 'Open your Nest', url: options.nestUrl || `${NEST_ORIGIN}/nest/` };
  const kicker = note.n ? '' : (note.key === 'welcome' ? 'Welcome' : 'Life Canvas');
  const unsubUrl = options.unsubUrl || `${NEST_ORIGIN}/nest/#email-preferences`;
  const prefsUrl = options.prefsUrl || preferencesUrl();
  const mailingAddress = options.mailingAddress || '';
  const parts = { preheader: note.preheader, kicker, subject: note.subject, paragraphs, action, unsubUrl, prefsUrl, mailingAddress };
  return {
    from: FROM_ADDRESS,
    reply_to: REPLY_TO,
    to: options.to ? [options.to] : [],
    subject: note.subject,
    html: htmlShell(parts),
    text: textBody(parts),
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export function letterByNumber(n) {
  return LETTERS.find((letter) => letter.n === n) || null;
}

export function checkinByIndex(index) {
  return CHECKINS[index % CHECKINS.length];
}

export function auditEmail(message, { expectTool = false, expectCanvas = false } = {}) {
  const problems = [];
  const html = message?.html || '';
  const text = message?.text || '';
  if (!/viewport" content="width=device-width/.test(html)) problems.push('missing viewport');
  if (!/max-width:600px/.test(html)) problems.push('missing mobile width');
  if (!html.includes('Unsubscribe') || !text.includes('Unsubscribe:')) problems.push('missing unsubscribe');
  if (!html.includes(preferencesUrl()) && !html.includes('Email preferences')) problems.push('missing preferences');
  if (!html.includes("lil' bird team") || !text.includes('Luke & the lil')) problems.push('missing signature');
  if (expectTool && !/\/nest\/\?tool=[a-z0-9-]+/.test(html)) problems.push('missing tool link');
  if (expectCanvas && !html.includes('/nest/?tab=canvas')) problems.push('missing canvas link');
  if (/\b(honest|genuinely|one next move|living picture|join the room)\b/i.test(`${message.subject} ${text}`)) problems.push('banned phrase');
  if (text.includes('—') || html.includes('—')) problems.push('em dash');
  if (/Note \d+ of \d+/.test(html) || /Note \d+ of \d+/.test(text)) problems.push('sequence number');
  const widths = [...html.matchAll(/width="(\d+)"/g)].map((m) => Number(m[1]));
  if (widths.some((w) => w > 600)) problems.push('oversized fixed width');
  return problems;
}

export function renderPreviewSet(profile) {
  const options = {
    firstName: 'Sam',
    profile,
    unsubUrl: 'https://lilbird-assessment.cwwq46sn7m.workers.dev/nest-letters/unsubscribe?e=preview&t=preview',
    mailingAddress: 'lil\' bird, preview address',
  };
  const items = [
    { id: 'welcome', title: WELCOME.subject, message: renderNote(WELCOME, options) },
    ...LETTERS.map((letter) => ({
      id: `n${letter.n}`,
      title: `${letter.n}. ${letter.subject}`,
      message: renderNote(letter, options),
    })),
    ...CHECKINS.map((note, index) => ({
      id: note.key,
      title: `Check-in ${index + 1}. ${note.subject}`,
      message: renderNote(note, options),
    })),
  ];
  return items;
}

export { CHECKINS, LETTERS, WELCOME };
