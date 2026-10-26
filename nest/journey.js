import {
  BOUNDARY_UNTANGLER,
  answersReady,
  buildInsertRow,
  cleanAnswers,
  fallbackInsight,
} from './journey-reflect.js';
import { createJourneySession, saveOutcome } from './journey-session.js';

const STAGES = [
  {
    key: 'situation',
    kicker: '1 of 5 · Situation',
    title: 'Where does this feel tangled?',
    prompt: 'Who is this with, and what keeps happening?',
    placeholder: 'A person, and the pattern between you...',
  },
  {
    key: 'difficulty',
    kicker: '2 of 5 · Difficulty',
    title: 'What makes it hard?',
    prompt: 'What gets in the way of saying what you need?',
    placeholder: 'The worry, the habit, the loyalty...',
  },
  {
    key: 'need',
    kicker: '3 of 5 · Underlying need',
    title: 'What do you need underneath?',
    prompt: 'Under the friction, what are you actually needing?',
    placeholder: 'Rest, respect, time, clarity...',
  },
  {
    key: 'boundary',
    kicker: '4 of 5 · Possible boundary',
    title: 'What boundary could you hold?',
    prompt: 'Say it in a way that is clear and still kind.',
    placeholder: 'I can... and I will not...',
  },
  {
    key: 'nextStep',
    kicker: '5 of 5 · Next step',
    title: 'What is one realistic step?',
    prompt: 'One thing you could do in the next week. Small enough to happen.',
    placeholder: 'One action, with a time...',
  },
];

const session = createJourneySession();

const state = {
  mode: 'home',
  stage: 0,
  draft: emptyDraft(),
  insight: '',
  insightFromModel: false,
  rows: [],
  status: '',
  busy: false,
};

function emptyDraft() {
  return { situation: '', difficulty: '', need: '', boundary: '', nextStep: '' };
}

function host() {
  return window.__nestJourneyHost || null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pane() {
  return document.getElementById('pane-journey');
}

function preview() {
  return document.getElementById('sidebar-journey-card');
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function currentMemberId() {
  const api = host();
  const member = api && api.getUser ? api.getUser() : null;
  return member && member.id ? member.id : '';
}

async function loadRows() {
  const api = host();
  const user = api && api.getUser ? api.getUser() : null;
  if (!api || !user?.id) {
    state.rows = [];
    return;
  }
  const result = await api.sb
    .from('journey_reflections')
    .select('id, tool_id, tool_version, answers, insight, next_step, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (result.error) {
    state.rows = [];
    state.status = result.error.code === '42P01' || /journey_reflections/.test(result.error.message || '')
      ? 'Saving opens once the Journey table is in place. Nothing is stored until then.'
      : 'Your saved reflections could not be loaded.';
    return;
  }
  state.rows = result.data || [];
  if (state.status.indexOf('Journey table') === 0) state.status = '';
}

function renderPreview() {
  const card = preview();
  if (!card) return;
  const steps = state.rows.filter((row) => row.next_step);
  const latest = steps[0];
  card.innerHTML = latest
    ? '<p class="sidebar-eyebrow">my journey</p><h4>Your next step</h4><p>' +
      escapeHtml(latest.next_step) +
      '</p><button type="button" class="btn btn-outline full" data-open-journey>Open My Journey</button>'
    : '<p class="sidebar-eyebrow">my journey</p><h4>Tools for the Tangle</h4><p>A short exercise can leave you with one next step. Saving is optional.</p><button type="button" class="btn btn-outline full" data-open-journey>Open My Journey</button>';
}

function homeHtml() {
  const steps = state.rows.filter((row) => row.next_step);
  const stepItems = steps.length
    ? steps.slice(0, 6).map((row) => {
        return '<li><p>' + escapeHtml(row.next_step) + '</p><span>' +
          escapeHtml(BOUNDARY_UNTANGLER.title) + ' · ' + escapeHtml(formatWhen(row.created_at)) +
          '</span></li>';
      }).join('')
    : '<li class="journey-empty">Saved next steps will show up here.</li>';

  const reflections = state.rows.length
    ? state.rows.map((row) => reflectionHtml(row)).join('')
    : '<p class="journey-empty">Nothing saved yet. You can finish an exercise and leave it unsaved.</p>';

  return (
    '<div class="journey-home">' +
      '<p class="journey-kicker">tools for the tangle</p>' +
      '<h2>My Journey</h2>' +
      '<p class="journey-lead">Short exercises for a tangle you are in. About five to ten minutes. Save only if you want to come back to it.</p>' +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<article class="journey-tool-card">' +
        '<p class="journey-kicker">5 to 10 minutes</p>' +
        '<h3>Boundary Untangler</h3>' +
        '<p>Name a difficult boundary, what makes it hard, what you need, a kinder way to hold it, and one step you can actually take.</p>' +
        '<button type="button" class="btn btn-gold" data-start-tool>Begin</button>' +
      '</article>' +
      '<section class="journey-block"><h3>Your Next Steps</h3><ul class="journey-steps">' + stepItems + '</ul></section>' +
      '<section class="journey-block"><h3>Your Reflections</h3>' + reflections + '</section>' +
      '<section class="journey-block">' +
        '<h3>Your Life Canvas</h3>' +
        '<p>Life changes, and so do we. Your Life Canvas is a place to notice what\'s shifting and what might need a little attention.</p>' +
        '<button type="button" class="btn btn-outline" data-open-canvas>Visit My Life Canvas</button>' +
      '</section>' +
    '</div>'
  );
}

function reflectionHtml(row) {
  const answers = row.answers || {};
  const step = answers.nextStep || row.next_step || '';
  const lines = [
    ['Situation', answers.situation],
    ['Difficulty', answers.difficulty],
    ['Need', answers.need],
    ['Boundary', answers.boundary],
    ['Next step', step],
  ].filter((pair) => pair[1]);
  const body = lines.map((pair) => '<p><span>' + escapeHtml(pair[0]) + '</span> ' + escapeHtml(pair[1]) + '</p>').join('');
  const note = row.insight ? '<p class="journey-note"><span>Coaching note</span> ' + escapeHtml(row.insight) + '</p>' : '';
  const stepLine = '<p class="journey-card-step"><span>Next step</span> ' + escapeHtml(step || 'Not named') + '</p>';
  return (
    '<article class="journey-reflection">' +
      '<header><h4>' + escapeHtml(BOUNDARY_UNTANGLER.title) + '</h4><time>' + escapeHtml(formatWhen(row.created_at)) + '</time></header>' +
      stepLine +
      '<details><summary>Revisit</summary>' + body + note + '</details>' +
      '<button type="button" class="btn btn-outline" data-delete-reflection="' + escapeHtml(row.id) + '">Delete</button>' +
    '</article>'
  );
}

function exerciseHtml() {
  const stage = STAGES[state.stage];
  const value = state.draft[stage.key] || '';
  return (
    '<div class="journey-exercise">' +
      '<button type="button" class="btn btn-outline journey-back" data-close-exercise>Close without saving</button>' +
      '<p class="journey-kicker">' + escapeHtml(stage.kicker) + '</p>' +
      '<h2>' + escapeHtml(stage.title) + '</h2>' +
      '<p class="journey-lead">' + escapeHtml(stage.prompt) + '</p>' +
      '<textarea id="journey-stage-input" rows="6" maxlength="2000" placeholder="' + escapeHtml(stage.placeholder) + '">' +
      escapeHtml(value) + '</textarea>' +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<div class="journey-actions">' +
        (state.stage > 0 ? '<button type="button" class="btn btn-outline" data-stage-back>Back</button>' : '') +
        '<button type="button" class="btn btn-gold" data-stage-next>' +
        (state.stage === STAGES.length - 1 ? 'See what I wrote' : 'Next') +
        '</button>' +
      '</div>' +
    '</div>'
  );
}

function completionHtml() {
  const clean = cleanAnswers(state.draft);
  const lines = STAGES.map((stage) => '<p><span>' + escapeHtml(stage.title) + '</span> ' + escapeHtml(clean[stage.key]) + '</p>').join('');
  const note = state.insight
    ? '<div class="journey-note"><span>' + (state.insightFromModel ? 'Coaching note' : 'A note you can keep') + '</span><p>' + escapeHtml(state.insight) + '</p></div>'
    : '';
  return (
    '<div class="journey-exercise">' +
      '<p class="journey-kicker">boundary untangler</p>' +
      '<h2>A little more clarity.</h2>' +
      '<p class="journey-lead">You\'ve taken a moment to untangle something that matters. Here\'s what you\'ve discovered, and one small step you might take from here.</p>' +
      '<div class="journey-summary">' + lines + '</div>' +
      note +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<div class="journey-actions">' +
        '<button type="button" class="btn btn-outline" data-reflect ' + (state.busy ? 'disabled' : '') + '>Reflect with lil\' bird</button>' +
        '<button type="button" class="btn btn-gold" data-save ' + (state.busy ? 'disabled' : '') + '>Save to My Journey</button>' +
        '<button type="button" class="btn btn-outline" data-close-exercise>Close without saving</button>' +
      '</div>' +
    '</div>'
  );
}

function render() {
  const el = pane();
  if (!el) return;
  if (state.mode === 'exercise') el.innerHTML = exerciseHtml();
  else if (state.mode === 'done') el.innerHTML = completionHtml();
  else el.innerHTML = homeHtml();
  renderPreview();
  const input = document.getElementById('journey-stage-input');
  if (input) input.focus();
}

function readStage() {
  const input = document.getElementById('journey-stage-input');
  if (!input) return;
  const stage = STAGES[state.stage];
  state.draft[stage.key] = input.value.slice(0, 2000);
}

function startTool() {
  session.invalidate();
  state.mode = 'exercise';
  state.stage = 0;
  state.draft = emptyDraft();
  state.insight = '';
  state.insightFromModel = false;
  state.busy = false;
  state.status = '';
  render();
}

function closeExercise() {
  session.invalidate();
  state.mode = 'home';
  state.stage = 0;
  state.draft = emptyDraft();
  state.insight = '';
  state.insightFromModel = false;
  state.busy = false;
  state.status = '';
  render();
}

function nextStage() {
  readStage();
  const stage = STAGES[state.stage];
  if (clip(state.draft[stage.key]).length < 2) {
    state.status = 'Add a little more before you go on.';
    render();
    return;
  }
  state.status = '';
  if (state.stage < STAGES.length - 1) {
    state.stage += 1;
    render();
    return;
  }
  state.mode = 'done';
  render();
}

function clip(value) {
  return String(value || '').trim();
}

function reflectStillCurrent(ticket, memberId) {
  return session.reflectApplies(ticket) && currentMemberId() === memberId;
}

async function reflect() {
  const api = host();
  const memberId = currentMemberId();
  if (!answersReady(state.draft) || state.busy) return;
  const answers = cleanAnswers(state.draft);
  const ticket = session.beginReflect();
  const timer = setTimeout(() => ticket.abort(), 12000);
  state.busy = true;
  state.status = 'Reading what you wrote...';
  render();
  const fallback = fallbackInsight(answers);
  try {
    if (!api || !memberId) {
      if (!reflectStillCurrent(ticket, memberId)) return;
      state.insight = fallback;
      state.insightFromModel = false;
      return;
    }
    const headers = await api.authHeaders();
    if (!reflectStillCurrent(ticket, memberId)) return;
    const res = await fetch(api.workerUrl.replace(/\/$/, '') + '/journey/reflect', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        toolId: BOUNDARY_UNTANGLER.id,
        toolVersion: BOUNDARY_UNTANGLER.version,
        answers,
      }),
      signal: ticket.signal,
    });
    if (!reflectStillCurrent(ticket, memberId)) return;
    if (!res.ok) throw new Error('reflect failed');
    const data = await res.json();
    if (!reflectStillCurrent(ticket, memberId)) return;
    state.insight = data && data.insight && data.degraded !== true ? data.insight : fallback;
    state.insightFromModel = !!(data && data.insight && data.degraded !== true);
  } catch (e) {
    if (!reflectStillCurrent(ticket, memberId)) return;
    state.insight = fallback;
    state.insightFromModel = false;
  } finally {
    clearTimeout(timer);
    if (reflectStillCurrent(ticket, memberId)) {
      state.busy = false;
      state.status = '';
      render();
    }
  }
}

async function saveReflection() {
  const api = host();
  const memberId = currentMemberId();
  if (!api || !memberId || !answersReady(state.draft) || state.busy) return;
  const lock = session.tryBeginSave(memberId);
  if (!lock) return;
  state.busy = true;
  state.status = 'Saving...';
  render();
  try {
    let failed = false;
    try {
      const row = buildInsertRow(memberId, state.draft, state.insight);
      const result = await api.sb.from('journey_reflections').insert(row).select('id');
      if (result && result.error) failed = true;
    } catch (e) {
      failed = true;
    }
    const outcome = saveOutcome(session.saveApplies(lock, currentMemberId()), failed);
    if (!outcome.updateScreen) return;
    if (outcome.keepAnswers) {
      state.busy = false;
      state.status = outcome.message;
      render();
      return;
    }
    if (session.generation() !== lock.sessionGeneration || currentMemberId() !== lock.memberId) return;
    state.draft = emptyDraft();
    state.insight = '';
    state.insightFromModel = false;
    state.mode = 'home';
    state.busy = false;
    state.status = 'Saved. You can do this exercise again. The earlier one stays.';
    await loadRows();
    if (session.generation() !== lock.sessionGeneration || currentMemberId() !== lock.memberId) return;
    render();
  } finally {
    session.finishSave(lock);
  }
}

async function deleteReflection(id) {
  const api = host();
  const user = api && api.getUser ? api.getUser() : null;
  if (!api || !user?.id || !id) return;
  if (!window.confirm('Delete this reflection? It will be removed from your Journey.')) return;
  const result = await api.sb.from('journey_reflections').delete().eq('id', id).eq('user_id', user.id);
  if (result.error) {
    state.status = 'That reflection could not be deleted.';
    render();
    return;
  }
  state.rows = state.rows.filter((row) => row.id !== id);
  state.status = 'Deleted.';
  render();
}

function onClick(event) {
  const target = event.target.closest('button');
  if (!target || !pane()?.contains(target) && !preview()?.contains(target)) return;
  if ('openJourney' in target.dataset) {
    host()?.setTab('journey');
    return;
  }
  if (!pane()?.contains(target)) return;
  if ('startTool' in target.dataset) startTool();
  else if ('closeExercise' in target.dataset) closeExercise();
  else if ('stageNext' in target.dataset) nextStage();
  else if ('stageBack' in target.dataset) {
    readStage();
    state.stage = Math.max(0, state.stage - 1);
    state.status = '';
    render();
  } else if ('openCanvas' in target.dataset) host()?.setTab('canvas');
  else if ('reflect' in target.dataset) void reflect();
  else if ('save' in target.dataset) void saveReflection();
  else if (target.dataset.deleteReflection) void deleteReflection(target.dataset.deleteReflection);
}

document.addEventListener('click', onClick);

window.LilbirdJourney = {
  async refresh() {
    if (!currentMemberId()) {
      session.invalidate();
      state.rows = [];
      state.mode = 'home';
      state.stage = 0;
      state.draft = emptyDraft();
      state.insight = '';
      state.insightFromModel = false;
      state.busy = false;
      state.status = '';
      renderPreview();
      return;
    }
    await loadRows();
    if (state.mode === 'home') render();
    else renderPreview();
  },
  reset() {
    session.invalidate();
    state.mode = 'home';
    state.stage = 0;
    state.draft = emptyDraft();
    state.insight = '';
    state.insightFromModel = false;
    state.rows = [];
    state.status = '';
    state.busy = false;
    const el = pane();
    if (el) el.innerHTML = '';
    const card = preview();
    if (card) card.innerHTML = '';
  },
  show() {
    if (state.mode === 'home') render();
  },
};

document.dispatchEvent(new Event('lilbird-journey-ready'));
