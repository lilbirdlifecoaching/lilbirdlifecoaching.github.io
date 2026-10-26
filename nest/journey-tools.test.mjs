import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { answersReady, cleanAnswers } from './journey-reflect.js';
import {
  CATEGORIES,
  TOOLS,
  recommendTools,
  reflectionView,
  resolveToolLink,
  searchTools,
  toolById,
} from './journey-tools.js';

const IDS = [
  'boundary-untangler',
  'communication-reset',
  'connection-check',
  'expectations-audit',
  'shadows-sparks',
  'identity-reflection',
  'courage-compass',
  'decision-clarity',
  'transition-map',
  'energy-inventory',
  'rhythm-reset',
  'rest-or-escape',
  'family-expectations',
  'responsibility-inventory',
  'workload-reset',
];

function filled(tool, overrides) {
  const answers = {};
  tool.stages.forEach((stage) => {
    answers[stage.key] = stage.optional ? '' : 'Enough words for ' + stage.label;
  });
  return Object.assign(answers, overrides || {});
}

test('the library has the fifteen tools, each with its own shape', () => {
  assert.equal(TOOLS.length, 15);
  assert.deepEqual(TOOLS.map((tool) => tool.id), IDS);
  const categories = new Set(CATEGORIES.map((item) => item.id));
  TOOLS.forEach((tool) => {
    assert.equal(tool.version, 1);
    assert.equal(categories.has(tool.category), true);
    assert.ok(tool.stages.length >= 4 && tool.stages.length <= 6, tool.id);
    assert.equal(tool.stages[tool.stages.length - 1].key, 'nextStep');
    assert.equal(tool.stages[tool.stages.length - 1].optional, false);
    assert.equal(answersReady(filled(tool), tool), true);
    const missing = filled(tool, { nextStep: ' ' });
    assert.equal(answersReady(missing, tool), false);
    const cleaned = cleanAnswers(Object.assign({ leftover: 'nope', userId: 'forged' }, filled(tool)), tool);
    assert.equal(cleaned.leftover, undefined);
    assert.equal(cleaned.userId, undefined);
  });
  const boundary = toolById('boundary-untangler');
  assert.equal(boundary.stages.some((stage) => stage.optional), false);
  assert.equal(boundary.stages[0].title, 'Where does this feel tangled?');
  const withOptional = TOOLS.filter((tool) => tool.id !== 'boundary-untangler');
  assert.equal(withOptional.every((tool) => tool.stages.some((stage) => stage.optional)), true);
});

test('an optional stage can be skipped, and a short optional answer cannot', () => {
  const tool = toolById('communication-reset');
  assert.equal(answersReady(filled(tool), tool), true);
  const short = filled(tool, { unsaid: 'x' });
  assert.equal(answersReady(short, tool), false);
  const kept = filled(tool, { unsaid: 'I wanted to say I was scared.' });
  assert.equal(answersReady(kept, tool), true);
  assert.equal(cleanAnswers(kept, tool).unsaid.includes('scared'), true);
});

test('search matches titles, categories, and everyday phrases', () => {
  assert.equal(searchTools('', 'all').length, 15);
  assert.deepEqual(searchTools('', 'family').map((tool) => tool.id), ['family-expectations', 'responsibility-inventory']);
  assert.equal(searchTools('texts at night', 'all')[0].id, 'boundary-untangler');
  assert.equal(searchTools('family', 'work').length, 0);
  const rhythms = searchTools('exhausted scrolling', 'rhythms').map((tool) => tool.id);
  assert.equal(rhythms.includes('energy-inventory'), true);
  assert.equal(rhythms.includes('rest-or-escape'), true);
  assert.equal(searchTools('nothing-like-this-phrase', 'all').length, 0);
});

test('recommendations stay local and do not pretend when nothing matches', () => {
  assert.equal(recommendTools('no').status, 'empty');
  const family = recommendTools('my parents expect too much of me');
  assert.equal(family.status, 'matched');
  assert.equal(family.tools[0].id, 'family-expectations');
  assert.ok(family.tools.length <= 3);
  const boundary = recommendTools('I cannot say no when my boss texts at night');
  assert.equal(boundary.tools.some((tool) => tool.id === 'boundary-untangler'), true);
  const broad = recommendTools('zzzz banana pickle');
  assert.equal(broad.status, 'broad');
  assert.deepEqual(broad.tools.map((tool) => tool.id), ['boundary-untangler', 'decision-clarity', 'energy-inventory']);
});

test('deep links resolve a tool and reject anything else', () => {
  assert.equal(resolveToolLink('Courage-Compass').tool.id, 'courage-compass');
  assert.equal(resolveToolLink('not-a-tool').reason, 'unknown');
  assert.equal(resolveToolLink('../secret').reason, 'invalid');
  assert.equal(resolveToolLink('').reason, 'missing');
  assert.equal(resolveToolLink('a').reason, 'invalid');
});

test('an older Boundary Untangler save is still readable, including a retired field', () => {
  const view = reflectionView({
    tool_id: 'boundary-untangler',
    tool_version: 1,
    next_step: 'Turn off chat notifications after 7pm this week.',
    insight: 'A note from before.',
    answers: {
      situation: 'Evening messages from a teammate.',
      difficulty: 'I worry the project stalls.',
      need: 'Evenings that are actually off.',
      boundary: 'I will answer work chat in the morning.',
      nextStep: 'Turn off chat notifications after 7pm this week.',
      retiredNote: 'An older field that should still show.',
    },
  });
  assert.equal(view.title, 'Boundary Untangler');
  assert.match(view.nextStep, /7pm/);
  assert.equal(view.fields.some((field) => field.label === 'Boundary' && /morning/.test(field.value)), true);
  assert.equal(view.fields.some((field) => field.label === 'retiredNote'), true);
  assert.equal(view.insight, 'A note from before.');
});

test('the page keeps recommendation text out of storage and out of the reflection request', () => {
  const page = readFileSync(new URL('./journey.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./nest-styles.css', import.meta.url), 'utf8');
  const tour = readFileSync(new URL('./nest-tour.js', import.meta.url), 'utf8');
  assert.match(page, /id="journey-recommend"/);
  assert.match(page, /recommendTools\(state\.recommendText\)/);
  assert.equal(page.includes('localStorage'), false);
  assert.match(page, /searchParams\.delete\('tool'\)/);
  assert.match(page, /__nestSkipTourForTool = true/);
  assert.match(tour, /if \(window\.__nestSkipTourForTool\) return;/);
  assert.match(styles, /\.journey-filters \{ display: flex; flex-wrap: wrap;/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  const fetchStart = page.indexOf('const res = await fetch');
  const fetchBlock = page.slice(fetchStart, page.indexOf('signal: ticket.signal', fetchStart));
  assert.equal(fetchBlock.includes('recommend'), false);
});
