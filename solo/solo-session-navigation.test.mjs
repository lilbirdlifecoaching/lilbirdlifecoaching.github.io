import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual shell function, including asynchronous hydration and timers.
const html = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('    async function openSession(sessionNumber)'), html.indexOf("    document.getElementById('book-continue').addEventListener"));
function fixture({ deferredMemory = false } = {}) {
  const timers = [], rendered = [], pending = [], elements = new Map();
  function element() {
    const classes = new Set();
    return { style: {}, disabled: false, value: '', innerHTML: '', classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, setAttribute() {}, addEventListener() {}, appendChild() {}, replaceChildren() {}, focus() {}, querySelector() { return null; } };
  }
  const doc = {
    documentElement: { style: { setProperty() {} } },
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelector(selector) { return selector.includes('#session-info ') ? null : doc.getElementById(selector); },
    createElement: element, createTextNode: text => ({ textContent: text })
  };
  doc.getElementById('view-session').classList.add('active');
  const sessions = [0, 1, 2].map(number => ({ number, tag: 'Session ' + number, title: 'Session ' + number, desc: 'Description', tools: [], color: '#123456', emoji: '', duration: '30 min' }));
  const context = vm.createContext({
    document: doc, SESSIONS: sessions, TOOL_MAP: {},
    sessionData: sessions.map(s => ({ session_number: s.number, status: 'available' })),
    currentUser: { id: 'fixture' }, activeSession: null, sessionOpenVersion: 0, isTyping: false, chatMsgs: [], exchangeCount: 0, sessionContext: {}, openedTools: {}, toolOutputsCache: {}, sessionTakeHome: '',
    hasSoloAccess: () => true, canOpenSession: () => true, renderDashboard() {}, setSessionInfoOpen() {}, showView() {}, syncSessionInfoChrome() {}, focusElNoScroll() {},
    loadSessionContext: async number => ({ forSession: number }),
    buildGreeting: number => 'greeting-' + number,
    renderMessage: (role, content) => rendered.push({ role, content }),
    setTimeout: fn => timers.push(fn),
    sb: { from(table) {
      const q = new Proxy({}, { get(target, key) {
        if (key === 'then') return resolve => Promise.resolve({ data: null }).then(resolve);
        if (key === 'single') return () => deferredMemory ? new Promise(resolve => pending.push(resolve)) : Promise.resolve({ data: null });
        return () => q;
      }}); return q;
    }}
  });
  vm.runInContext(source, context);
  return { context, rendered, pending, timers, doc, open: number => context.openSession(number) };
}
test('fast navigation cannot insert an earlier session greeting into the current conversation', async () => {
  const f = fixture();
  await f.open(0); await f.open(1);
  f.timers.forEach(fn => fn());
  assert.deepEqual(f.rendered.map(m => m.content), ['greeting-1']);
  assert.equal(f.context.sessionContext.forSession, 1);
});
test('an old memory response cannot replace the newly selected session history', async () => {
  const f = fixture({ deferredMemory: true });
  const first = f.open(0); await new Promise(setImmediate);
  const second = f.open(1); await new Promise(setImmediate);
  assert.equal(f.pending.length, 2);
  f.pending[1]({ data: { messages: [{ role: 'assistant', content: 'current-memory' }] } }); await second;
  f.pending[0]({ data: { messages: [{ role: 'assistant', content: 'stale-memory' }] } }); await first;
  assert.deepEqual(f.rendered.map(m => m.content), ['current-memory']);
});
test('navigation leaves in-flight chat saves and open tool work attached to the current session', async () => {
  const f = fixture(); await f.open(0);
  f.context.isTyping = true; await f.open(1); assert.equal(f.context.activeSession.number, 0);
  f.context.isTyping = false; f.doc.getElementById('tool-embed-wrap').classList.add('active');
  await f.open(2); assert.equal(f.context.activeSession.number, 0);
});

test('delayed tool and completion cues cannot leak into another session', async () => {
  const f = fixture(); await f.open(0); f.timers.length = 0;
  const renderSource = html.slice(html.indexOf('    function renderMessage(role,'), html.indexOf('    // ── TOOL SNAPSHOT RENDERER'));
  let toolCards = 0;
  f.context.TOOL_MAP.example = {};
  f.context.renderToolCard = () => toolCards++;
  vm.runInContext(renderSource, f.context);
  f.context.renderMessage('assistant', '[TOOL:example][COMPLETE]');
  const staleCues = f.timers.splice(0);
  await f.open(1); f.timers.length = 0;
  staleCues.forEach(fn => fn());
  assert.equal(toolCards, 0);
  assert.equal(f.doc.getElementById('complete-panel').classList.contains('visible'), false);
  f.context.renderMessage('assistant', '[TOOL:example][COMPLETE]');
  f.timers.forEach(fn => fn());
  assert.equal(toolCards, 1);
  assert.equal(f.doc.getElementById('complete-panel').classList.contains('visible'), true);
});
