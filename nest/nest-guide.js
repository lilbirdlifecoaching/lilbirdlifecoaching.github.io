/**
 * lil' bird guide. A Nest Plus conversation in Luke's manner.
 * The website chat widget stays a separate help desk.
 */

export const GUIDE_PRODUCTS = ['nest_plus', 'coaching', 'life_change_intensive'];

export const GUIDE_TOOLS = [
  { id: 'boundary-untangler', title: 'Boundary Untangler', minutes: '5 to 10 minutes', when: 'a boundary, a no, or people-pleasing is the tangle they are actually in' },
  { id: 'communication-reset', title: 'Communication Reset', minutes: 'about 8 minutes', when: 'one conversation snagged and the words are still ringing' },
  { id: 'connection-check', title: 'Connection Check', minutes: 'about 8 minutes', when: 'a relationship feels distant and they want to see it plainly' },
  { id: 'expectations-audit', title: 'Expectations Audit', minutes: 'about 8 minutes', when: 'they are carrying what someone else expects, or what they expect of themselves' },
  { id: 'shadows-sparks', title: 'Shadows & Sparks', minutes: 'about 10 minutes', when: 'fear and desire are mixed up in the same goal' },
  { id: 'identity-reflection', title: 'Identity Reflection', minutes: 'about 8 minutes', when: 'they are unsure which part of them is speaking' },
  { id: 'courage-compass', title: 'Courage Compass', minutes: 'about 8 minutes', when: 'they have named a fear and are ready to face one true direction' },
  { id: 'decision-clarity', title: 'Decision Clarity', minutes: 'about 10 minutes', when: 'a real decision is in front of them and the options are tangled' },
  { id: 'transition-map', title: 'Transition Map', minutes: 'about 8 minutes', when: 'something is ending or beginning and they need to see where they are in it' },
  { id: 'energy-inventory', title: 'Energy Inventory', minutes: 'about 8 minutes', when: 'they are tired or scattered and need to see what gives and what drains' },
  { id: 'rhythm-reset', title: 'Rhythm Reset', minutes: 'about 8 minutes', when: 'their week has no shape and they want one small rhythm back' },
  { id: 'rest-or-escape', title: 'Rest or Escape?', minutes: 'about 8 minutes', when: 'they cannot tell rest from avoidance' },
  { id: 'family-expectations', title: 'Family Expectations', minutes: 'about 8 minutes', when: 'family roles or old expectations are in the room' },
  { id: 'responsibility-inventory', title: 'Responsibility Inventory', minutes: 'about 8 minutes', when: 'they are holding too much and need to see what is actually theirs' },
  { id: 'workload-reset', title: 'Workload Reset', minutes: 'about 8 minutes', when: 'work has swollen and they need one honest cut or ask' },
];

function toolMark() {
  return /\[TOOL:([a-z0-9-]+)\]/gi;
}
const PUBLIC_SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
const PUBLIC_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';

export function guideAllowed(products) {
  const owned = new Set((products || []).map((item) => String(item || '')));
  return GUIDE_PRODUCTS.some((product) => owned.has(product));
}

export function guideToolById(id) {
  const key = String(id || '').trim().toLowerCase();
  return GUIDE_TOOLS.find((tool) => tool.id === key) || null;
}

export function buildGuidePrompt(firstName) {
  const name = String(firstName || '').trim();
  const who = name ? name : 'this person';
  const tools = GUIDE_TOOLS.map((tool) => `- [TOOL:${tool.id}] only when ${tool.when}`).join('\n');
  return `You are lil' bird guide, an illustrated guide in the manner of Luke Haythorpe. You are with ${who} inside their Nest.

If they ask who they are talking to, say you are the next best thing to being in the room with Luke. Do not pretend he is typing this himself. Do not sell a session, a course, or a booking. Do not include a link or HTML.

How you coach:
- Ask one question. One.
- Use their words. If they say stuck, say stuck.
- Stay with the thing underneath the practical problem before you offer a move.
- Two or three short paragraphs. No lists, no headers, no bold markers.
- No em dashes. No "it's not X, it's Y".
- Never: synergy, leverage, tapestry, journey, navigate, resonate, delve, quiet, honest, genuinely, deeply, truly.

A tool is a rare offer. Add it only when you are convinced this exact exercise would help, after they have said enough for you to know that, and never in your first reply. Put the signal on its own line at the very end. Offer at most one. If you are unsure, ask another question and offer nothing.

${tools}

The page turns that signal into a card. Do not describe the signal. Do not name the format.`;
}

export function parseGuideReply(raw, { userTurns = 1, offered = [] } = {}) {
  const source = String(raw || '');
  const seen = new Set((offered || []).map((id) => String(id || '').trim().toLowerCase()));
  let chosen = null;
  for (const match of source.matchAll(toolMark())) {
    const tool = guideToolById(match[1]);
    if (!tool || seen.has(tool.id) || userTurns < 2) continue;
    chosen = { id: tool.id, title: tool.title, minutes: tool.minutes };
    break;
  }
  const reply = source
    .replace(toolMark(), ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { reply, tool: chosen };
}

function bearer(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function firstNameFromUser(user) {
  const meta = user?.user_metadata || {};
  const direct = String(meta.first_name || meta.given_name || '').trim();
  if (direct) return direct.split(/\s+/)[0];
  const full = String(meta.full_name || meta.name || '').trim();
  return full ? full.split(/\s+/)[0] : '';
}

function cleanMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 12) return null;
  const clean = [];
  for (const message of messages) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) return null;
    const content = String(message.content || '').trim();
    if (!content || content.length > 4000) return null;
    clean.push({ role: message.role, content });
  }
  if (clean[clean.length - 1].role !== 'user') return null;
  return clean;
}

export async function handleNestGuide(request, env, ctx) {
  const { origin, allowedOrigins, corsHeaders, jsonResponse } = ctx;
  const fetchImpl = ctx.fetchImpl || fetch;
  const token = bearer(request);
  if (!token) return jsonResponse({ error: 'Please log in.' }, 401, origin, allowedOrigins);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin, allowedOrigins);
  }
  const messages = cleanMessages(payload?.messages);
  if (!messages) return jsonResponse({ error: 'invalid_messages' }, 400, origin, allowedOrigins);

  const supabaseUrl = String(env.SUPABASE_URL || PUBLIC_SUPABASE_URL).replace(/\/$/, '');
  const anon = String(env.SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON);
  const authHeaders = { Authorization: `Bearer ${token}`, apikey: anon };

  const userRes = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders });
  if (!userRes.ok) return jsonResponse({ error: 'Please log in.' }, 401, origin, allowedOrigins);
  const user = await userRes.json();
  if (!user?.id) return jsonResponse({ error: 'Please log in.' }, 401, origin, allowedOrigins);

  const entRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/user_entitlements?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=product`,
    { headers: { ...authHeaders, Accept: 'application/json' } },
  );
  if (!entRes.ok) return jsonResponse({ error: 'Not allowed' }, 403, origin, allowedOrigins);
  const rows = await entRes.json();
  const products = Array.isArray(rows) ? rows.map((row) => row.product) : [];
  if (!guideAllowed(products)) {
    return jsonResponse({ error: 'nest_plus_required' }, 403, origin, allowedOrigins);
  }

  if (env.CHAT_RATE_LIMITER && typeof env.CHAT_RATE_LIMITER.limit === 'function') {
    try {
      const { success } = await env.CHAT_RATE_LIMITER.limit({ key: 'guide:' + user.id });
      if (!success) return jsonResponse({ error: 'rate_limited' }, 429, origin, allowedOrigins);
    } catch {
      /* a limiter miss should not open the guide to everyone, and should not block a member */
    }
  }

  if (!env.ANTHROPIC_API_KEY) return jsonResponse({ error: 'guide_unavailable' }, 503, origin, allowedOrigins);

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const offered = Array.isArray(payload.offered) ? payload.offered.slice(0, GUIDE_TOOLS.length) : [];
  const modelRes = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: buildGuidePrompt(firstNameFromUser(user)),
      messages,
    }),
  });
  const data = await modelRes.json().catch(() => null);
  if (!modelRes.ok) return jsonResponse({ error: 'guide_unavailable' }, 502, origin, allowedOrigins);
  const text = (data?.content || [])
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
  const parsed = parseGuideReply(text, { userTurns, offered });
  if (!parsed.reply) return jsonResponse({ error: 'guide_unavailable' }, 502, origin, allowedOrigins);
  return jsonResponse({ reply: parsed.reply, tool: parsed.tool }, 200, origin, allowedOrigins);
}
