import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildGuidePrompt,
  guideAllowed,
  handleNestGuide,
  parseGuideReply,
} from './nest-guide.js';

const ctx = {
  origin: 'https://lilbird.life',
  allowedOrigins: ['https://lilbird.life'],
  corsHeaders: () => ({}),
  jsonResponse: (body, status) => new Response(JSON.stringify(body), { status }),
};

function request(body, token = 'member-token') {
  return new Request('https://lilbird-chat.example/guide', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('a free nest cannot open the guide, and Nest Plus can', () => {
  assert.equal(guideAllowed([]), false);
  assert.equal(guideAllowed(['solo_course']), false);
  assert.equal(guideAllowed(['nest_plus']), true);
  assert.equal(guideAllowed(['first_flight']), true);
  assert.equal(guideAllowed(['coaching']), true);
  assert.equal(guideAllowed(['life_change_intensive']), true);
});

test('the guide prompt coaches and does not sell a booking', () => {
  const prompt = buildGuidePrompt('Ada');
  assert.match(prompt, /with Ada/);
  assert.match(prompt, /Ask one question/);
  assert.match(prompt, /\[TOOL:decision-clarity\]/);
  assert.doesNotMatch(prompt, /IMREADY|lb-book-trigger|First Flight/);
  assert.doesNotMatch(prompt, /<a /);
});

test('a tool is kept only after a real exchange, and markup never reaches the member', () => {
  const early = parseGuideReply('What is the decision?\n[TOOL:decision-clarity]', { userTurns: 1, offered: [] });
  assert.equal(early.tool, null);
  assert.equal(early.reply, 'What is the decision?');

  const ready = parseGuideReply(
    'You said the offer is ready. <a href="#">Book</a> **Next.**\n[TOOL:workload-reset]',
    { userTurns: 2, offered: [] },
  );
  assert.equal(ready.tool.id, 'workload-reset');
  assert.equal(ready.reply.includes('<'), false);
  assert.equal(ready.reply.includes('**'), false);
  assert.equal(ready.reply.includes('TOOL'), false);

  const repeat = parseGuideReply('Stay with that.\n[TOOL:workload-reset]', { userTurns: 3, offered: ['workload-reset'] });
  assert.equal(repeat.tool, null);
  const unknown = parseGuideReply('Stay with that.\n[TOOL:not-a-tool]', { userTurns: 3, offered: [] });
  assert.equal(unknown.tool, null);
});

test('the guide route refuses a stranger and a free member before it calls the model', async () => {
  const anon = await handleNestGuide(request({ messages: [{ role: 'user', content: 'Hello' }] }, ''), { ANTHROPIC_API_KEY: 'x' }, ctx);
  assert.equal(anon.status, 401);

  let modelCalled = false;
  const fetchImpl = async (url) => {
    if (String(url).includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', user_metadata: { first_name: 'Ada' } }), { status: 200 });
    }
    if (String(url).includes('user_entitlements')) {
      return new Response(JSON.stringify([{ product: 'solo_course' }]), { status: 200 });
    }
    modelCalled = true;
    return new Response('{}', { status: 500 });
  };
  const denied = await handleNestGuide(
    request({ messages: [{ role: 'user', content: 'I feel stuck.' }] }),
    { ANTHROPIC_API_KEY: 'x' },
    { ...ctx, fetchImpl },
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error, 'nest_plus_required');
  assert.equal(modelCalled, false);
});

test('a Nest Plus member receives the coaching text with the tool signal removed', async () => {
  const fetchImpl = async (url, init) => {
    const href = String(url);
    if (href.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', user_metadata: { first_name: 'Ada' } }), { status: 200 });
    }
    if (href.includes('user_entitlements')) {
      return new Response(JSON.stringify([{ product: 'nest_plus' }]), { status: 200 });
    }
    const sent = JSON.parse(init.body);
    assert.match(sent.system, /with Ada/);
    assert.equal(sent.messages.at(-1).content, 'People who already know they want help.');
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'You said stuck. What would forward look like this week?\n[TOOL:decision-clarity]' }],
    }), { status: 200 });
  };
  const ok = await handleNestGuide(
    request({
      messages: [
        { role: 'assistant', content: 'Tell me what is in front of you.' },
        { role: 'user', content: 'I feel stuck about the offer.' },
        { role: 'assistant', content: 'Stuck about the offer. Who is it for?' },
        { role: 'user', content: 'People who already know they want help.' },
      ],
    }),
    { ANTHROPIC_API_KEY: 'secret' },
    { ...ctx, fetchImpl },
  );
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.tool.id, 'decision-clarity');
  assert.equal(body.reply.includes('TOOL'), false);
  assert.equal(body.reply.includes('stuck'), true);
});

test('the chat worker sends Nest Plus members to the guide route', () => {
  const workerPath = "/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird site/lilbird-chat-cloudflare-worker.js";
  const worker = readFileSync(workerPath, 'utf8');
  assert.match(worker, /import \{ handleNestGuide \} from '\.\/nest-guide\.js'/);
  assert.match(worker, /pathname === '\/guide'/);
  assert.match(worker, /return handleNestGuide\(/);
});
