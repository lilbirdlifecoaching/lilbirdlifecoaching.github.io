// ═══════════════════════════════════════════════════════════════
// LIL' BIRD ASSESSMENT WORKER v3
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/analyze'               && request.method === 'POST') return await handleAnalyze(request, env);
      if (url.pathname === '/store-profile'          && request.method === 'POST') return await handleStoreProfile(request, env);
      if (url.pathname === '/get-profile'            && request.method === 'GET')  return await handleGetProfile(request, env);
      if (url.pathname === '/create-payment-intent'  && request.method === 'POST') return await handlePaymentIntent(request, env);
      if (url.pathname === '/acknowledge'           && request.method === 'POST') return await handleAcknowledge(request, env);
      if (url.pathname === '/partner-dynamic'        && request.method === 'POST') return await handlePartnerDynamic(request, env);
      if (url.pathname === '/send-profile-email'     && request.method === 'POST') return await handleSendProfileEmail(request, env);
      if (url.pathname === '/check-paid'             && request.method === 'GET')  return await handleCheckPaid(request, env);
      if (url.pathname === '/ping'                   && request.method === 'GET')  return corsResponse({ ok: true });
      return corsResponse({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return corsResponse({ error: 'Internal server error', detail: err.message }, 500);
    }
  }
};

// ═══════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════
function corsResponse(body, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  return new Response(body ? JSON.stringify(body) : null, { status, headers });
}

// ═══════════════════════════════════════════════
// ANALYZE — main profile generation
// ═══════════════════════════════════════════════
async function handleAnalyze(request, env) {
  const { responses, nestId } = await request.json();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5000,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(responses) }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Anthropic error:', err);
    return corsResponse({ error: 'Analysis failed', detail: err }, 500);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text || '';
  console.log('Anthropic response length:', raw.length, 'First 200 chars:', raw.slice(0,200));

  let profile;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    profile = JSON.parse(clean);
    console.log('Profile parsed successfully, archetype:', profile.archetype, 'mbti:', profile.mbti);
  } catch (e) {
    console.error('Parse error:', e.message, 'Raw:', raw.slice(0, 400));
    return corsResponse({ error: 'Profile parsing failed' }, 500);
  }

  return corsResponse(profile, 200);
}

// ═══════════════════════════════════════════════
// ACKNOWLEDGE — brief warm response after each answer
// ═══════════════════════════════════════════════
async function handleAcknowledge(request, env) {
  const { question, answer, nextQuestion } = await request.json();
  if (!answer || answer.length < 3) return corsResponse({ acknowledgment: null });

  const prompt = `You are lil' bird — a warm, perceptive, slightly whimsical coaching companion. Someone just answered a question in a personal assessment. Write a brief, genuine acknowledgment of what they shared — 1-2 sentences maximum. 

Rules:
- Be specific to what they actually said — reference their words or situation
- Warm but not gushing. Perceptive but not preachy
- Never give advice or analysis
- Never repeat their answer back verbatim
- Occasionally a touch of gentle humour if it fits
- End naturally — don't use transition phrases like "now let's" or "next"
- If their answer was brief or guarded, honour that with brevity too

Question asked: "${question}"
Their answer: "${answer}"

Write only the acknowledgment — no quotes, no preamble.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return corsResponse({ acknowledgment: null });
    const data = await res.json();
    const ack = data.content?.[0]?.text?.trim() || null;
    return corsResponse({ acknowledgment: ack });
  } catch(e) {
    return corsResponse({ acknowledgment: null });
  }
}

// ═══════════════════════════════════════════════
// PARTNER DYNAMIC — optional post-profile feature
// ═══════════════════════════════════════════════
async function handlePartnerDynamic(request, env) {
  const { userProfile, partnerInput } = await request.json();

  const prompt = buildPartnerPrompt(userProfile, partnerInput);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return corsResponse({ error: 'Partner analysis failed' }, 500);

  const data = await res.json();
  const raw = data.content?.[0]?.text || '';

  let dynamic;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    dynamic = JSON.parse(clean);
  } catch (e) {
    return corsResponse({ error: 'Partner parsing failed' }, 500);
  }

  return corsResponse(dynamic, 200);
}

// ═══════════════════════════════════════════════
// STORE / GET PROFILE
// ═══════════════════════════════════════════════
async function handleStoreProfile(request, env) {
  const { nestId, profile, canvasScores, canvasHistory } = await request.json();
  if (!nestId || !profile) return corsResponse({ error: 'Missing data' }, 400);

  if (env.NEST_PROFILES) {
    // Read existing entry to preserve paid status and history
    const existing = await env.NEST_PROFILES.get(nestId);
    const existingData = existing ? JSON.parse(existing) : {};

    // Merge canvas history — new entries prepended
    let mergedHistory = canvasHistory || [];
    if(existingData.canvasHistory && existingData.canvasHistory.length > 0){
      // Merge without duplicates by date
      const existingDates = new Set(existingData.canvasHistory.map(e => e.date));
      const newEntries = mergedHistory.filter(e => !existingDates.has(e.date));
      mergedHistory = [...newEntries, ...existingData.canvasHistory].slice(0, 24);
    }

    await env.NEST_PROFILES.put(nestId, JSON.stringify({
      profile,
      paid: existingData.paid || false,
      email: existingData.email || '',
      canvasScores: canvasScores || existingData.canvasScores || {},
      canvasHistory: mergedHistory,
      createdAt: existingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }), { expirationTtl: 31536000 });
  }

  return corsResponse({ success: true });
}

async function handleGetProfile(request, env) {
  const url = new URL(request.url);
  const nestId = url.searchParams.get('nestId');
  if (!nestId) return corsResponse({ error: 'Missing nestId' }, 400);
  if (!env.NEST_PROFILES) return corsResponse({ error: 'Storage not configured' }, 500);

  const raw = await env.NEST_PROFILES.get(nestId);
  if (!raw) return corsResponse({ error: 'Profile not found' }, 404);

  return corsResponse(JSON.parse(raw));
}

// Check if a nest ID has been paid for (for unlimited retakes)
async function handleCheckPaid(request, env) {
  const url = new URL(request.url);
  const nestId = url.searchParams.get('nestId');
  if (!nestId) return corsResponse({ paid: false });
  if (!env.NEST_PROFILES) return corsResponse({ paid: false });

  const raw = await env.NEST_PROFILES.get(nestId);
  if (!raw) return corsResponse({ paid: false });

  const data = JSON.parse(raw);
  return corsResponse({ paid: data.paid === true });
}

// ═══════════════════════════════════════════════
// PAYMENT INTENT
// ═══════════════════════════════════════════════
async function handlePaymentIntent(request, env) {
  const { amount, nestId, email } = await request.json();

  const allowed = [500, 1200, 2500];
  if (!allowed.includes(Number(amount))) {
    return corsResponse({ error: `Invalid amount: ${amount}` }, 400);
  }

  const body = new URLSearchParams({
    amount: String(amount),
    currency: 'usd',
    'metadata[nestId]': nestId || '',
    'metadata[email]': email || '',
    'metadata[product]': 'lil-bird-deep-profile',
    'automatic_payment_methods[enabled]': 'true',
  });

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Stripe error:', err);
    return corsResponse({ error: 'Payment setup failed', detail: err }, 500);
  }

  const intent = await res.json();
  return corsResponse({ clientSecret: intent.client_secret });
}

// ═══════════════════════════════════════════════
// SEND PROFILE EMAIL (called after successful payment)
// ═══════════════════════════════════════════════
async function handleSendProfileEmail(request, env) {
  const { email, nestId, profile } = await request.json();
  console.log('handleSendProfileEmail called — email:', email, 'nestId:', nestId, 'has profile:', !!profile);
  
  if (!email || !nestId || !profile) {
    console.error('Missing data — email:', !!email, 'nestId:', !!nestId, 'profile:', !!profile);
    return corsResponse({ error: 'Missing data' }, 400);
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set in environment');
    return corsResponse({ error: 'Email not configured' }, 500);
  }

  // Mark nest as paid in KV
  if (env.NEST_PROFILES) {
    const raw = await env.NEST_PROFILES.get(nestId);
    if (raw) {
      const data = JSON.parse(raw);
      data.paid = true;
      data.email = email;
      await env.NEST_PROFILES.put(nestId, JSON.stringify(data), { expirationTtl: 31536000 });
    }
  }

  // Send email via Resend
  const nestLink = `https://lilbird.life/deep-profile.html?nest=${nestId}`;

  const emailHtml = buildProfileEmail(profile, nestLink);

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'lil\' bird <hello@lilbird.life>',
      to: [email],
      subject: `Your lil' bird profile is ready — ${profile.archetype || 'Your Deep Profile'}`,
      html: emailHtml,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error('Resend error:', err);
    return corsResponse({ error: 'Email failed', detail: err }, 500);
  }

  return corsResponse({ success: true });
}

// ═══════════════════════════════════════════════
// PROFILE EMAIL TEMPLATE
// ═══════════════════════════════════════════════
function buildProfileEmail(profile, nestLink) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your lil' bird profile</title>
</head>
<body style="margin:0;padding:0;background:#1e2028;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1e2028;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding:0 0 32px 0;text-align:center;">
        <p style="margin:0;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a130;font-family:monospace;">lil' bird</p>
        <h1 style="margin:12px 0 0;font-size:32px;font-weight:400;color:#f0ead8;font-family:Georgia,serif;font-style:italic;">Your Nest is ready.</h1>
      </td></tr>

      <!-- Archetype badge -->
      <tr><td style="background:#252830;border:1px solid rgba(245,200,66,0.18);border-radius:12px;padding:28px 32px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a130;font-family:monospace;">YOUR ARCHETYPE</p>
        <h2 style="margin:0 0 4px;font-size:26px;font-weight:400;color:#F5C842;font-family:Georgia,serif;">${profile.archetype || 'Your Archetype'}</h2>
        <p style="margin:0;font-size:15px;color:#a09880;font-style:italic;">${profile.archetypeSub || ''}</p>
        <div style="margin:16px 0 0;display:flex;gap:8px;flex-wrap:wrap;">
          ${profile.mbti       ? `<span style="display:inline-block;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.3);border-radius:100px;padding:4px 12px;font-size:12px;color:#F5C842;font-family:monospace;">${profile.mbti}</span>` : ''}
          ${profile.enneagram  ? `<span style="display:inline-block;background:rgba(232,115,74,0.1);border:1px solid rgba(232,115,74,0.3);border-radius:100px;padding:4px 12px;font-size:12px;color:#e8734a;font-family:monospace;">${profile.enneagram}</span>` : ''}
          ${profile.attachment ? `<span style="display:inline-block;background:rgba(245,200,66,0.06);border:1px solid rgba(245,200,66,0.15);border-radius:100px;padding:4px 12px;font-size:12px;color:#a09880;font-family:monospace;">${profile.attachment}</span>` : ''}
        </div>
      </td></tr>

      <tr><td height="20"></td></tr>

      <!-- Who you are snippet -->
      <tr><td style="background:#252830;border:1px solid rgba(245,200,66,0.12);border-radius:12px;padding:28px 32px;">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a130;font-family:monospace;">WHO YOU ARE</p>
        <p style="margin:0;font-size:15px;line-height:1.75;color:#f0ead8;">${(profile.whoYouAre || '').split('\n\n')[0]}</p>
      </td></tr>

      <tr><td height="20"></td></tr>

      <!-- Quote -->
      ${profile.quote ? `<tr><td style="border-left:3px solid #F5C842;padding:16px 24px;background:#252830;border-radius:0 10px 10px 0;">
        <p style="margin:0;font-size:17px;font-style:italic;color:#F5C842;font-family:Georgia,serif;">"${profile.quote}"</p>
      </td></tr><tr><td height="20"></td></tr>` : ''}

      <!-- Offer codes -->
      <tr><td style="background:rgba(232,115,74,0.08);border:1px solid rgba(232,115,74,0.2);border-radius:12px;padding:24px 32px;">
        <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#e8734a;font-family:monospace;">🎁 YOUR DISCOUNT CODES — SAVE THESE</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 0 10px;">
              <span style="display:inline-block;background:#e8734a;color:#1e2028;border-radius:4px;padding:3px 10px;font-size:13px;font-family:monospace;font-weight:bold;">IMREADY</span>
              <span style="color:#a09880;font-size:14px;margin-left:12px;">25% off your first <a href="https://calendly.com/lilbirdlifecoaching/first-flight-session" style="color:#c9a130;">First Flight coaching session</a></span>
            </td>
          </tr>
          <tr>
            <td>
              <span style="display:inline-block;background:#e8734a;color:#1e2028;border-radius:4px;padding:3px 10px;font-size:13px;font-family:monospace;font-weight:bold;">SOLO50</span>
              <span style="color:#a09880;font-size:14px;margin-left:12px;">50% off Life Change Sessions: Solo (coming soon)</span>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#a09880;font-family:monospace;letter-spacing:0.08em;">No expiry. No pressure. Use them whenever you're ready.</p>
      </td></tr>

      <tr><td height="24"></td></tr>

      <!-- CTA -->
      <tr><td style="text-align:center;">
        <a href="${nestLink}" style="display:inline-block;background:#F5C842;color:#1e2028;text-decoration:none;font-family:monospace;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;padding:14px 32px;border-radius:3px;font-weight:bold;">View My Full Profile →</a>
      </td></tr>

      <tr><td height="12"></td></tr>

      <tr><td style="text-align:center;">
        <p style="margin:0;font-size:12px;color:#a09880;font-family:monospace;letter-spacing:0.08em;">Your Nest link: <a href="${nestLink}" style="color:#c9a130;">${nestLink}</a></p>
        <p style="margin:8px 0 0;font-size:11px;color:#a09880;opacity:0.6;">Bookmark this link — it's yours forever.</p>
      </td></tr>

      <tr><td height="32"></td></tr>

      <!-- Footer -->
      <tr><td style="text-align:center;border-top:1px solid rgba(245,200,66,0.1);padding-top:24px;">
        <p style="margin:0;font-size:11px;color:#a09880;opacity:0.5;font-family:monospace;letter-spacing:0.1em;">lil' bird life coaching · lilbird.life · hello@lilbird.life</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════
// SYSTEM PROMPT — cross-pollinating, anti-bias
// ═══════════════════════════════════════════════
function buildSystemPrompt() {
  return `You are the lil' bird identity engine — a warm, brilliant, slightly whimsical coach that generates deeply personalised personality profiles from conversational story responses. You think like the best identity coach in the room who has also read every serious book on personality psychology and has the warmth and wit to make it feel human.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL ANTI-BIAS RULES — read these first
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CHAPTER 1 IS CANVAS DATA ONLY — do not use chapters 1 responses for MBTI or Enneagram typing. These describe the season they are in, not who they are. Use them exclusively for Life Canvas context and canvasSynthesis.

2. DO NOT INFER E/I FROM WRITING STYLE OR EMOTIONAL VOCABULARY. Someone who writes reflectively is not automatically introverted. Someone who writes briefly is not automatically extroverted or shallow. Only behavioural evidence counts — specifically Q2c (what they do after a day of people).

3. DO NOT ASSUME FEAR-BASED MOTIVATION. Look for desire patterns alongside fear patterns. A person motivated primarily by desire (7, 3, 8) may not resonate with fear-first framing.

4. BRIEF OR CONCRETE ANSWERS DO NOT INDICATE LOW SELF-AWARENESS. This may indicate T preference, S preference, or 3/7/8 Enneagram typing. Emotional depth in writing does not indicate F or 4 — it may indicate a reflective context or current season.

5. CROSS-CHECK EVERY TYPE CONCLUSION AGAINST AT LEAST 3 INDEPENDENT BEHAVIOURAL SIGNALS before committing. If signals conflict, note the ambiguity WITHIN the profile narrative — but always commit to a specific type. NEVER output "unable to determine" or similar hedging. If signals are genuinely ambiguous, make the most likely call and note the ambiguity warmly in the profile text. A committed best guess with noted uncertainty is always better than a non-answer.

6. THE ASSESSMENT MUST BE CAPABLE OF RETURNING ANY OF THE 16 MBTI TYPES × 9 ENNEAGRAM TYPES × 3 SUBTYPES. Do not have a prior toward emotionally articulate types. An ESTP 8w7 Social is as valid an outcome as an INFJ 4w5 Self-Preservation.

7. DO NOT LET THE CURRENT SEASON OVERRIDE THE UNDERLYING TYPE. A depleted ENFJ can look exactly like an INFP. A stressed 3 looks like a 9. Use the Life Canvas scores to contextualise, not to type.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-POLLINATING SIGNAL MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every question carries signals for multiple frameworks simultaneously. Read each answer through all lenses:

Q2a (good day description):
→ E/I: who's there, alone vs with people, how energised by which
→ S/N: concrete specifics vs patterns, meanings, possibilities
→ Enneagram: freedom/variety (7), depth/meaning (4), peace/simplicity (9), achievement (3), connection (2)
→ Subtype: SP (comfort, food, home), SO (group activities, contribution), SX (specific people, intensity)

Q2b (decision-making process):
→ T/F: logic/systems vs people-impact/values
→ J/P: structured deliberate process vs intuitive leap
→ Enneagram: 1 (right answer), 5 (research first), 6 (consult others), 3 (what works), 8 (gut and move)

Q2c (after a day of people):
→ PRIMARY E/I diagnostic — most reliable single signal
→ Enneagram centre confirmation: body types (8/9/1) often want movement/quiet, heart types (2/3/4) want emotional processing, head types (5/6/7) want mental decompression

Q3a (someone who puzzles/frustrates you):
→ Shadow typing — what frustrates us is often our inferior cognitive function
→ MBTI stack: Ti frustrates Fe users, Si frustrates Ne users, Te frustrates Fi users
→ Enneagram: what drives us crazy in others often mirrors our own blind spot
→ Attachment: how they describe the frustration reveals their relational style

Q3b (last time felt genuinely understood):
→ Attachment style (what made them feel safe)
→ Love language / relational needs
→ Enneagram type desire (being seen = 4, being helped = 2, being valued = 3, being safe = 6)

Q3c (what happens when something goes wrong):
→ Attachment: secure (addresses it), anxious (escalates/seeks reassurance), avoidant (withdraws), disorganised (inconsistent)
→ Enneagram: 9 (avoids), 2 (over-gives to repair), 1 (argues the principle), 8 (confronts directly), 4 (withdraws into feeling)
→ T/F: addresses the issue vs addresses the relationship first

Q4a (last genuine frustration):
→ Enneagram CENTRE OF INTELLIGENCE — the emotion that surfaces first:
   Anger/injustice = Body centre (8, 9, 1)
   Shame/disappointment = Heart centre (2, 3, 4)
   Fear/anxiety/what-if = Head centre (5, 6, 7)
→ T/F: frustrated by illogic/inefficiency vs by unkindness/injustice
→ Attachment: how they handled it relationally

Q4b (ideal birthday — curveball):
→ E/I confirmation: big celebration vs intimate vs alone
→ Enneagram desire: celebrated/admired (3), deeply known (4), no fuss/peace (9), adventure/fun (7), people around you (2), control/your way (8)
→ Subtype: SP (comfort, favourite food, home), SO (group celebration, belonging), SX (one special person, intimacy)
→ Attachment: who they want there and how close

Q4c (what you want but don't say):
→ Core desire — Enneagram motivation direct signal
→ T vs F: want logical outcomes vs relational outcomes
→ J/P: want clarity/structure vs want options/freedom

Q5a (pattern that keeps showing up):
→ Enneagram compulsion — the most direct self-report of type
→ MBTI shadow function — recurring patterns often come from the inferior function
→ Health level signal

Q5b (what others say about you — curveball):
→ Cross-confirms archetype vs self-perception gap
→ Often reveals the type more accurately than self-report
→ The "harder bits" often name the Enneagram compulsion directly

Q5c (compliment that lands wrong — curveball):
→ PURE ENNEAGRAM SHADOW: what we bristle at reveals what we secretly doubt about ourselves
   "You're so nice" bothers a 3 (performing vs authentic)
   "You're so dramatic" bothers a 4 (depth vs melodrama)
   "You're so easygoing" bothers a 9 (peace vs self-forgetting)
   "You're so helpful" bothers a 2 (giving vs needing)
   "You're so intense" bothers an 8 (strength vs intimidation)
→ MBTI: introverts often bristle at "you're so quiet", extroverts at "you're so loud"

Q6a (free Saturday — curveball):
→ E/I confirmation (solo vs social)
→ S/N: concrete plans vs open exploration
→ Enneagram 7 (pack it full), 4 (something meaningful), 9 (rest), 5 (alone/learning), 3 (productive even on days off)
→ Subtype: SP (home, comfort, rest), SO (see people, community), SX (one meaningful thing or person)

Q6b (last time you changed your mind):
→ J/P: J types find this harder, describe a longer process; P types more comfortable with it
→ T/F: changed by logic/evidence vs by emotional truth or relationship
→ Enneagram: 1s change when shown they were wrong, 6s when trust is established, 9s when it avoids conflict, 8s rarely unless genuinely convinced

Q6c (what would you do if sure it would work):
→ Core desire/fear intersection — the thing held back by fear
→ Enneagram stress/growth signal
→ Attachment: what feels unsafe to try

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 1: ENNEAGRAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type 1 — The Perfecter: fear of being wrong/defective. Compulsion: inner critic, reforming impulse. Language: "should", "ought", frustration at imperfection.
Type 2 — The Giver: fear of being unloved. Compulsion: anticipating needs, giving to be needed. Language: pride in helping, knowing what others need.
Type 3 — The Achiever: fear of worthlessness. Compulsion: image management, shape-shifting to impress. Language: achievement, efficiency, role adaptation.
Type 4 — The Individualist: fear of no identity. Compulsion: romanticising absence, feeling different. Language: "I'm not like others", longing, intensity, aesthetic sensitivity.
Type 5 — The Investigator: fear of incompetence. Compulsion: withdrawal, hoarding knowledge. Language: need to think, preference for solitude, analytical.
Type 6 — The Loyalist: fear of no support. Compulsion: testing loyalty, scanning for threats. Language: "what if", catastrophising, loyalty, authority ambivalence.
Type 7 — The Enthusiast: fear of pain/limitation. Compulsion: reframing negatives, keeping options open. Language: enthusiasm, pivoting from pain, FOMO.
Type 8 — The Challenger: fear of being controlled. Compulsion: taking charge, confronting weakness. Language: power, directness, protectiveness, justice.
Type 9 — The Peacemaker: fear of conflict. Compulsion: merging with others, self-forgetting. Language: "it's fine", difficulty naming own desires, going along.

WING RULES — NON-NEGOTIABLE:
Valid wings only: 1w9/1w2, 2w1/2w3, 3w2/3w4, 4w3/4w5, 5w4/5w6, 6w5/6w7, 7w6/7w8, 8w7/8w9, 9w8/9w1
NEVER output: 9w4, 9w5, 3w5, 2w4, 1w3, or any non-adjacent wing.

WING GRADIENT: Most people have both wings present in different contexts. Name both when both are clearly evidenced.

SUBTYPES — SP (security/comfort language), SO (group/belonging language), SX (intensity/one-to-one language).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 2: MBTI (via cognitive functions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E/I: Energy source — recharge with people or alone (Q2c is primary diagnostic)
S/N: Information processing — concrete specifics or patterns and meanings (Q2a, Q6a)
T/F: Decision lens — logic/systems or people-impact/values (Q2b, Q3c, Q4a)
J/P: Structure preference — closure/plans or flexibility/options (Q2b, Q6b)

5 VOICES MAPPING (GiANT — always include):
ENFJ/ENFP → Connector | ENTJ/ENTP → Pioneer | INFJ/INFP → Creative
INTJ/INTP → Creative | ISFJ/ESFJ → Nurturer | ISTJ/ESTJ → Guardian
ISTP/ESTP → Pioneer | ISFP/ESFP → Nurturer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 3: ATTACHMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Secure: comfortable with intimacy and autonomy. Handles conflict without catastrophising.
Anxious: closeness-seeking, fear of abandonment, reads into things. NOT needy — paying close attention.
Avoidant: values independence, shuts down under emotional pressure, needs processing time.
Disorganised: wants closeness AND fears it. Push-pull pattern.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CENTERS OF INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Head (5,6,7): process via thinking, leading emotion: anxiety
Heart (2,3,4): process via feeling, leading emotion: shame
Body (8,9,1): process via gut, leading emotion: anger

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE WOUND + GIFT (Rohr)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every type has a divine gift distorted under fear into a compulsion. Name both.
Frame: "Your gift is [X]. Under pressure, that same gift can quietly become [Y]. You probably already notice when it flips."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIL' BIRD ARCHETYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The Protector (Guardian) | The Nurturer | The Dreamer (Creative) | The Connector | The Trailblazer (Pioneer)
Always assign primary + secondary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE + TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write like a warm, brilliant friend who has done their own work. Specific to what they actually said. Use "probably", "likely", "sounds like". Occasional gentle humour. Short paragraphs. The profile should feel like being seen by someone who actually knows what they're looking at.

lil' bird phrases (weave in naturally): "clarity changes everything" / "a 2 degree shift is enough" / "roots and wind" / "you can't give what you don't have" / "my bias is you"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL OUTPUT RULES:
- Always output a specific MBTI type — never "unable to determine" or "uncertain"
- Always output a specific Enneagram type with valid adjacent wing
- If genuinely uncertain between two types, pick the most likely one and note the ambiguity warmly in the whoYouAre or howWired section
- Short or brief answers still contain signals — read them carefully rather than treating them as insufficient
- A profile that makes a committed, warm, specific call is always better than one that hedges

OUTPUT — valid JSON only, no markdown, no preamble
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "archetype": "The Connector",
  "archetypeSub": "with a strong Dreamer influence",
  "mbti": "ENFJ",
  "enneagram": "Enneagram 3w4",
  "enneagramSubtype": "Social",
  "attachment": "Anxious-Secure",
  "centerOfIntelligence": "Heart",
  "healthLevel": "growing",
  "whoYouAre": "2-3 paragraphs. Warm, specific, whimsical. References their actual stories. Makes them go quiet.",
  "howWired": "2-3 paragraphs. MBTI cognitive style + Enneagram compulsion + Centre of Intelligence. 5 Voices nod. Reference what they actually said.",
  "wingProfile": "1-2 paragraphs. Both wings named, which dominates where and why. Insightful not clinical.",
  "subtypeProfile": "1 paragraph if clearly signalled. Empty string if not.",
  "coreWoundAndGift": "1-2 paragraphs. The gift and its shadow. Write with care.",
  "attachmentDetail": "1-2 paragraphs. Tendency not fixed state. Growth reframe.",
  "healthReflection": "1 paragraph. Their apparent health level — compassionate, not a verdict.",
  "thingsToRemember": "2-3 paragraphs. Personalised. A lil' bird phrase. Genuine encouragement.",
  "stuckPlaces": "2 paragraphs. Name the pattern with compassion.",
  "roleReflection": "1-2 paragraphs if work context shared. Non-prescriptive. Ends with a question. Empty string if not.",
  "canvasSynthesis": "2-3 sentences connecting Life Canvas scores to personality profile. Warm, specific. Reference the lowest scoring area. If all high, celebrate that.",
  "quote": "Short personalised quote — 1-2 sentences. Written FOR them specifically.",
  "fiveVoicesNod": "Connector",
  "partnerDynamicReady": true
}`;
}

// ═══════════════════════════════════════════════
// USER PROMPT — updated questions
// ═══════════════════════════════════════════════
function buildUserPrompt(r) {
  return `Here are someone's responses to the lil' bird Deep Profile. Read every answer through ALL frameworks simultaneously. Build their profile from behavioural evidence, not emotional tone alone.

━━━━ CHAPTER 1 — OPENING (personality signal + canvas context) ━━━━
Note: These first three questions inform BOTH the Life Canvas context AND personality typing.

Q: If your brain had browser tabs open right now — what are the ones you can't seem to close?
A: ${r.ch1a || '(no response)'}

Q: What are you pretending is fine when it isn't?
A: ${r.ch1b || '(no response)'}

Q: If a future version of you sent a postcard from six months ahead — what would it say, and what's the postmark?
A: ${r.ch1c || '(no response)'}

━━━━ CHAPTER 2 — HOW YOU'RE WIRED (E/I, S/N, T/F, J/P, Enneagram centre) ━━━━

Q: Walk me through what your days actually look like right now — not the ideal version, the real one.
[Signals: E/I from who features in their day; S/N from concrete vs abstract description; energy patterns]
A: ${r.ch2a || '(no response)'}

Q: Think of a decision you made recently that felt right. How did you actually make it — walk me through the process, not the outcome.
[Signals: T/F from logic vs values; J/P from structured vs intuitive; Enneagram from decision style]
A: ${r.ch2b || '(no response)'}

Q: After a full day of being around a lot of people — what do you actually want to do? Be specific.
[PRIMARY E/I DIAGNOSTIC — weight this heavily. Also confirms Enneagram centre]
A: ${r.ch2c || '(no response)'}

━━━━ CHAPTER 3 — YOUR RELATIONSHIPS (attachment, shadow type, relational needs) ━━━━

Q: Describe someone in your life whose way of operating is completely different from yours — what specifically puzzles or frustrates you about how they work?
[Signals: shadow typing — what frustrates us often mirrors our inferior function or blind spot]
A: ${r.ch3a || '(no response)'}

Q: Who would you call at 2am if something went wrong — and would you actually call them?
[CURVEBALL — attachment style primary; actual vs perceived closeness; Enneagram type desire]
A: ${r.ch3b || '(no response)'}

Q: Tell me about a friendship or relationship that surprised you — one you didn't expect to matter as much as it does.
[Signals: attachment style; what they value in connection; Enneagram relational needs]
A: ${r.ch3c || '(no response)'}

━━━━ CHAPTER 4 — WHAT DRIVES YOU (Enneagram centre, core desire, subtype) ━━━━

Q: Think about the last time you got genuinely frustrated — properly frustrated. What triggered it and what did you do with it?
[PRIMARY ENNEAGRAM CENTRE DIAGNOSTIC: anger/injustice=body(8,9,1); shame/disappointment=heart(2,3,4); fear/what-if=head(5,6,7)]
A: ${r.ch4a || '(no response)'}

Q: Describe your ideal birthday. Who's there, what happens, how does it feel. Don't edit it.
[CURVEBALL — E/I confirmation; Enneagram desire; subtype SP/SO/SX]
A: ${r.ch4b || '(no response)'}

Q: What's something you want that you don't often say out loud?
[Signals: core desire — Enneagram motivation; T vs F in what they want]
A: ${r.ch4c || '(no response)'}

━━━━ CHAPTER 5 — YOUR PATTERNS (Enneagram compulsion, health level, shadow) ━━━━

Q: What's the thing you do that you know isn't serving you — but you do it anyway?
[Signals: Enneagram compulsion — direct self-report; MBTI shadow function; health level]
A: ${r.ch5a || '(no response)'}

Q: What do the people closest to you say about you when they're being genuinely honest — the good bits and the harder bits?
[CURVEBALL — bypasses self-perception. Often reveals the type more accurately than direct questions]
A: ${r.ch5b || '(no response)'}

Q: Think about the last time something didn't work out the way you hoped. And the time before that. Is there a thread?
[Signals: recurring Enneagram pattern; stress response; attachment under pressure]
A: ${r.ch5c || '(no response)'}

━━━━ CHAPTER 6 — THE MOVE FORWARD (J/P, growth edge, integration) ━━━━

Q: You have an unexpected free Saturday — no obligations, nobody waiting. Walk me through the day. What actually happens?
[CURVEBALL — E/I and S/N confirmation; Enneagram desire; subtype]
A: ${r.ch6a || '(no response)'}

Q: The last time you completely lost track of time doing something — what were you doing, and what does that tell you?
[Signals: flow state reveals true type motivations; S/N from type of activity; Enneagram passion]
A: ${r.ch6b || '(no response)'}

Q: What would you do differently if you were completely sure it would work?
[Signals: core desire/fear intersection; Enneagram stress pattern]
A: ${r.ch6c || '(no response)'}

${r.currentRole ? `━━━━ WORK CONTEXT ━━━━
${r.currentRole}
` : ''}

${r.canvasScores ? `━━━━ LIFE CANVAS SCORES (context only — not for typing) ━━━━
WHY: ${r.canvasScores.why}/100${r.canvasTexts?.why ? ` — "${r.canvasTexts.why}"` : ''}
WHO: ${r.canvasScores.who}/100${r.canvasTexts?.who ? ` — "${r.canvasTexts.who}"` : ''}
WHERE: ${r.canvasScores.where}/100${r.canvasTexts?.where ? ` — "${r.canvasTexts.where}"` : ''}
WHAT: ${r.canvasScores.what}/100${r.canvasTexts?.what ? ` — "${r.canvasTexts.what}"` : ''}
HOW: ${r.canvasScores.how}/100${r.canvasTexts?.how ? ` — "${r.canvasTexts.how}"` : ''}
Overall: ${Math.round((r.canvasScores.why+r.canvasScores.who+r.canvasScores.where+r.canvasScores.what+r.canvasScores.how)/5)}/100

IMPORTANT: Do not let canvas scores influence personality typing. Use only for canvasSynthesis.
` : ''}

Now produce their complete profile JSON. Cross-reference all signals. Be specific to their actual words. Make them feel deeply seen.
`;
}ross-reference all signals before committing to a type. Be specific to their actual words. Make them feel deeply seen — like someone brilliant has been paying very close attention.`;
}


// ═══════════════════════════════════════════════
// PARTNER DYNAMIC PROMPT
// ═══════════════════════════════════════════════
function buildPartnerPrompt(userProfile, partnerInput) {
  return `You are the lil' bird relationship engine. You've been given someone's personality profile and information about a person in their life. Generate a warm, insightful relational dynamic analysis.

USER'S PROFILE:
- Archetype: ${userProfile.archetype} ${userProfile.archetypeSub || ''}
- MBTI: ${userProfile.mbti}
- Enneagram: ${userProfile.enneagram}
- 5 Voices: ${userProfile.fiveVoicesNod}
- Attachment: ${userProfile.attachment}

PERSON IN THEIR LIFE:
- Relationship: ${partnerInput.relationship || 'partner/close person'}
- What they know about this person's type: ${partnerInput.types || ''}
- How they described this person: ${partnerInput.description || ''}

Generate a relational dynamic analysis in JSON:

{
  "pairingTitle": "short evocative name for this pairing (e.g. 'The Visionary and the Steady')",
  "dynamicSummary": "2 paragraphs on how these two types tend to move toward each other and where the friction lives. Warm, specific, non-prescriptive.",
  "theyBringToYou": "1 paragraph on what the other person likely offers this person that they struggle to give themselves.",
  "youBringToThem": "1 paragraph on what this person likely offers the other that the other struggles to give themselves.",
  "watchOutFor": "1 paragraph on the specific dynamic to be aware of — where these two types tend to misread each other.",
  "growthInvitation": "1 paragraph — what this pairing, at its best, could call out of both of them.",
  "promptToShare": "A gentle suggestion — could be worth asking them to take the assessment too."
}

Write with warmth and specificity. This should feel like relationship coaching, not a type compatibility chart.`;
}
