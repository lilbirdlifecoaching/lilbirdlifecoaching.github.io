import {
  answersReady,
  buildInsertRow,
  cleanAnswers,
  fallbackInsight,
  stageValueOk,
} from './journey-reflect.js?v=4';
import { createJourneySession, saveOutcome } from './journey-session.js';
import {
  CATEGORIES,
  categoryLabel,
  recommendTools,
  reflectionView,
  resolveToolLink,
  searchTools,
  toolById,
} from './journey-tools.js?v=1';

const session = createJourneySession();
let linkHandled = false;

if (new URLSearchParams(window.location.search).has('tool')) {
  window.__nestSkipTourForTool = true;
}

const state = {
  mode: 'home',
  toolId: '',
  stage: 0,
  draft: {},
  insight: '',
  insightFromModel: false,
  savedId: '',
  savedTitle: '',
  highlightId: '',
  rows: [],
  status: '',
  busy: false,
  query: '',
  category: 'all',
  recommendText: '',
};

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

function currentTool() {
  return toolById(state.toolId);
}

function emptyDraft(tool) {
  const draft = {};
  if (!tool) return draft;
  tool.stages.forEach((stage) => {
    draft[stage.key] = '';
  });
  return draft;
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
  if (!latest) {
    card.innerHTML = '<p class="sidebar-eyebrow">my journey</p><h4>Tools for the Tangle</h4><p>A short exercise can leave you with one next step. Saving is optional.</p><button type="button" class="btn btn-outline full" data-open-journey>Open My Journey</button>';
    return;
  }
  const view = reflectionView(latest);
  card.innerHTML = '<p class="sidebar-eyebrow">my journey</p><h4>Your next step</h4><p>' +
    escapeHtml(latest.next_step) +
    '</p><p>' + escapeHtml(view.title) + '</p><button type="button" class="btn btn-outline full" data-open-journey>Open My Journey</button>';
}

function toolCardHtml(item) {
  return (
    '<article class="journey-tool-card">' +
      '<p class="journey-kicker">' + escapeHtml(categoryLabel(item.category)) + ' · ' + escapeHtml(item.minutes) + '</p>' +
      '<h3>' + escapeHtml(item.title) + '</h3>' +
      '<p>' + escapeHtml(item.description) + '</p>' +
      '<button type="button" class="btn btn-gold" data-start-tool="' + escapeHtml(item.id) + '">Begin</button>' +
    '</article>'
  );
}

function libraryResultsHtml() {
  const found = searchTools(state.query, state.category);
  if (!found.length) {
    return '<p class="journey-empty">Nothing matches that yet. Try another phrase, or look through All.</p>';
  }
  return '<div class="journey-tool-grid">' + found.map(toolCardHtml).join('') + '</div>';
}

function recommendResultsHtml() {
  const result = recommendTools(state.recommendText);
  if (result.status === 'empty') return '';
  const lead = result.status === 'broad'
    ? 'Nothing lines up closely. Here are a few tools people often find useful. You can ignore them and browse the library.'
    : 'A few that might fit. You still choose.';
  return '<p class="journey-lead">' + lead + '</p>' + libraryCards(result.tools);
}

function libraryCards(list) {
  return '<div class="journey-tool-grid">' + list.map(toolCardHtml).join('') + '</div>';
}

function homeHtml() {
  const steps = state.rows.filter((row) => row.next_step || (row.answers && row.answers.nextStep));
  const stepItems = steps.length
    ? steps.slice(0, 8).map((row) => {
        const view = reflectionView(row);
        return '<li><button type="button" class="journey-step-link" data-open-reflection="' + escapeHtml(row.id) + '">' +
          escapeHtml(view.nextStep) + '</button><span>' +
          escapeHtml(view.title) + ' · ' + escapeHtml(formatWhen(row.created_at)) +
          '</span></li>';
      }).join('')
    : '<li class="journey-empty">Saved next steps will show up here.</li>';

  const reflections = state.rows.length
    ? state.rows.map((row) => reflectionHtml(row)).join('')
    : '<p class="journey-empty">Nothing saved yet. You can finish an exercise and leave it unsaved.</p>';

  const filters = CATEGORIES.map((item) => {
    const active = item.id === state.category ? ' is-active' : '';
    const pressed = item.id === state.category ? 'true' : 'false';
    return '<button type="button" class="btn btn-outline' + active + '" data-filter="' + escapeHtml(item.id) + '" aria-pressed="' + pressed + '">' +
      escapeHtml(item.label) + '</button>';
  }).join('');

  return (
    '<div class="journey-home">' +
      '<p class="journey-kicker">tools for the tangle</p>' +
      '<h2>Find a little clarity</h2>' +
      '<p class="journey-lead">Whatever feels tangled today, there’s a place to begin.</p>' +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<section class="journey-block journey-saved" id="journey-reflections"><h3>Saved reflections</h3>' +
        (state.rows.length
          ? '<p class="journey-lead">' + state.rows.length + (state.rows.length === 1 ? ' saved reflection. Open it to read it again.</p>' : ' saved reflections. Open one to read it again.</p>')
          : '') +
        reflections + '</section>' +
      '<section class="journey-block"><h3>Your next steps</h3><ul class="journey-steps">' + stepItems + '</ul></section>' +
      '<label class="journey-kicker" for="journey-search">Search</label>' +
      '<input id="journey-search" class="journey-search" type="search" maxlength="160" placeholder="What’s on your mind?" value="' + escapeHtml(state.query) + '">' +
      '<div class="journey-filters" role="group" aria-label="Categories">' + filters + '</div>' +
      '<div id="journey-library-results">' + libraryResultsHtml() + '</div>' +
      '<section class="journey-block">' +
        '<h3>Not sure where to begin?</h3>' +
        '<p>Tell us a little about what’s going on.</p>' +
        '<textarea id="journey-recommend" class="journey-recommend-input" rows="3" maxlength="400" placeholder="A few words is enough. This stays on this page.">' +
        escapeHtml(state.recommendText) + '</textarea>' +
        '<p class="journey-empty">This stays on this page. It is not saved.</p>' +
        '<div id="journey-recommend-results">' + recommendResultsHtml() + '</div>' +
      '</section>' +
      '<section class="journey-block">' +
        '<h3>Your Life Canvas</h3>' +
        '<p>Life changes, and so do we. Your Life Canvas is a place to notice what\'s shifting and what might need a little attention.</p>' +
        '<button type="button" class="btn btn-outline" data-open-canvas>Visit My Life Canvas</button>' +
      '</section>' +
    '</div>'
  );
}

function reflectionHtml(row) {
  const view = reflectionView(row);
  const body = view.fields.map((field) => '<p><span>' + escapeHtml(field.label) + '</span> ' + escapeHtml(field.value) + '</p>').join('');
  const note = view.insight ? '<p class="journey-note"><span>Coaching note</span> ' + escapeHtml(view.insight) + '</p>' : '';
  const stepLine = '<p class="journey-card-step"><span>Next step</span> ' + escapeHtml(view.nextStep || 'Not named') + '</p>';
  return (
    '<article class="journey-reflection" id="reflection-' + escapeHtml(row.id) + '">' +
      '<header><h4>' + escapeHtml(view.title) + '</h4><time>' + escapeHtml(formatWhen(row.created_at)) + '</time></header>' +
      stepLine +
      '<details' + (state.highlightId === row.id ? ' open' : '') + '><summary>Open this reflection</summary>' + body + note + '</details>' +
      '<button type="button" class="btn btn-outline" data-delete-reflection="' + escapeHtml(row.id) + '">Delete</button>' +
    '</article>'
  );
}

function introHtml(tool) {
  return (
    '<div class="journey-exercise">' +
      '<button type="button" class="btn btn-outline journey-back" data-close-exercise>Close without saving</button>' +
      '<p class="journey-kicker">' + escapeHtml(categoryLabel(tool.category)) + '</p>' +
      '<h2>' + escapeHtml(tool.title) + '</h2>' +
      '<p class="journey-lead">' + escapeHtml(tool.intro) + '</p>' +
      '<div class="journey-actions">' +
        '<button type="button" class="btn btn-gold" data-begin-stages>Begin</button>' +
        '<button type="button" class="btn btn-outline" data-close-exercise>Close without saving</button>' +
      '</div>' +
    '</div>'
  );
}

function exerciseHtml(tool) {
  const stage = tool.stages[state.stage];
  const value = state.draft[stage.key] || '';
  const optional = stage.optional ? '<p class="journey-empty">Optional. Leave this blank if nothing comes.</p>' : '';
  return (
    '<div class="journey-exercise">' +
      '<button type="button" class="btn btn-outline journey-back" data-close-exercise>Close without saving</button>' +
      '<p class="journey-kicker">' + escapeHtml((state.stage + 1) + ' of ' + tool.stages.length + ' · ' + stage.label) + '</p>' +
      '<h2>' + escapeHtml(stage.title) + '</h2>' +
      '<p class="journey-lead">' + escapeHtml(stage.prompt) + '</p>' +
      optional +
      '<textarea id="journey-stage-input" rows="6" maxlength="2000" placeholder="' + escapeHtml(stage.placeholder) + '">' +
      escapeHtml(value) + '</textarea>' +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<div class="journey-actions">' +
        (state.stage > 0 ? '<button type="button" class="btn btn-outline" data-stage-back>Back</button>' : '') +
        '<button type="button" class="btn btn-gold" data-stage-next>' +
        (state.stage === tool.stages.length - 1 ? 'See what I wrote' : 'Next') +
        '</button>' +
      '</div>' +
    '</div>'
  );
}

function completionHtml(tool) {
  const clean = cleanAnswers(state.draft, tool);
  const lines = tool.stages
    .filter((stage) => clean[stage.key])
    .map((stage) => '<p><span>' + escapeHtml(stage.label) + '</span> ' + escapeHtml(clean[stage.key]) + '</p>')
    .join('');
  const note = state.insight
    ? '<div class="journey-note"><span>' + (state.insightFromModel ? 'Coaching note' : 'A note you can keep') + '</span><p>' + escapeHtml(state.insight) + '</p><p class="journey-empty">Saving keeps this note. Another perspective replaces it.</p></div>'
    : '';
  const reflectLabel = state.insight ? 'Another perspective' : 'Reflect with lil\' bird';
  return (
    '<div class="journey-exercise">' +
      '<p class="journey-kicker">' + escapeHtml(tool.title) + '</p>' +
      '<h2>' + escapeHtml(tool.completionTitle) + '</h2>' +
      '<p class="journey-lead">' + escapeHtml(tool.completionLead) + '</p>' +
      '<div class="journey-summary">' + lines + '</div>' +
      note +
      (state.status ? '<p class="journey-status" role="status">' + escapeHtml(state.status) + '</p>' : '') +
      '<div class="journey-actions">' +
        '<button type="button" class="btn btn-outline" data-reflect ' + (state.busy ? 'disabled' : '') + '>' + reflectLabel + '</button>' +
        '<button type="button" class="btn btn-gold" data-save ' + (state.busy ? 'disabled' : '') + '>Save to My Journey</button>' +
        '<button type="button" class="btn btn-outline" data-close-exercise>Close without saving</button>' +
      '</div>' +
    '</div>'
  );
}

function savedHtml() {
  return (
    '<div class="journey-exercise">' +
      '<p class="journey-kicker">' + escapeHtml(state.savedTitle || 'My Journey') + '</p>' +
      '<h2>Saved to My Journey.</h2>' +
      '<p class="journey-lead">It is at the top of My Journey, with your other saved reflections. Only you can open it.</p>' +
      '<div class="journey-actions">' +
        '<button type="button" class="btn btn-gold" data-view-saved>View saved reflection</button>' +
        '<button type="button" class="btn btn-outline" data-close-exercise>Back to the tools</button>' +
      '</div>' +
    '</div>'
  );
}

function render() {
  const el = pane();
  if (!el) return;
  const tool = currentTool();
  if (state.mode === 'saved') {
    el.innerHTML = savedHtml();
  } else if ((state.mode === 'intro' || state.mode === 'exercise' || state.mode === 'done') && tool) {
    if (state.mode === 'intro') el.innerHTML = introHtml(tool);
    else if (state.mode === 'exercise') el.innerHTML = exerciseHtml(tool);
    else el.innerHTML = completionHtml(tool);
  } else {
    el.innerHTML = homeHtml();
  }
  renderPreview();
  const input = document.getElementById('journey-stage-input');
  if (input) input.focus();
}

function readStage() {
  const input = document.getElementById('journey-stage-input');
  const tool = currentTool();
  if (!input || !tool) return;
  const stage = tool.stages[state.stage];
  state.draft[stage.key] = input.value.slice(0, 2000);
}

function startTool(toolId) {
  session.invalidate();
  const tool = toolById(toolId);
  state.insight = '';
  state.insightFromModel = false;
  state.highlightId = '';
  state.busy = false;
  state.stage = 0;
  if (!tool) {
    state.mode = 'home';
    state.toolId = '';
    state.draft = {};
    state.status = 'That exercise is not in the library. Choose one below.';
    render();
    return;
  }
  state.toolId = tool.id;
  state.mode = 'intro';
  state.draft = emptyDraft(tool);
  state.status = '';
  state.recommendText = '';
  render();
}

function beginStages() {
  if (!currentTool()) return;
  state.mode = 'exercise';
  state.stage = 0;
  state.status = '';
  render();
}

function closeExercise() {
  session.invalidate();
  state.mode = 'home';
  state.stage = 0;
  state.toolId = '';
  state.draft = {};
  state.insight = '';
  state.insightFromModel = false;
  state.busy = false;
  state.status = '';
  render();
}

function nextStage() {
  const tool = currentTool();
  if (!tool) return;
  readStage();
  const stage = tool.stages[state.stage];
  if (!stageValueOk(stage, state.draft[stage.key])) {
    state.status = stage.optional
      ? 'Add a little more, or clear this one. It is optional.'
      : 'Add a little more before you go on.';
    render();
    return;
  }
  state.status = '';
  if (state.stage < tool.stages.length - 1) {
    state.stage += 1;
    render();
    return;
  }
  state.mode = 'done';
  render();
}

function reflectStillCurrent(ticket, memberId) {
  return session.reflectApplies(ticket) && currentMemberId() === memberId;
}

async function reflect() {
  const api = host();
  const tool = currentTool();
  const memberId = currentMemberId();
  if (!tool || !answersReady(state.draft, tool) || state.busy) return;
  const answers = cleanAnswers(state.draft, tool);
  const ticket = session.beginReflect();
  const timer = setTimeout(() => ticket.abort(), 12000);
  state.busy = true;
  state.status = 'Reading what you wrote...';
  render();
  const fallback = fallbackInsight(answers, tool);
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
        toolId: tool.id,
        toolVersion: tool.version,
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
  const tool = currentTool();
  const memberId = currentMemberId();
  if (!api || !tool || !memberId || !answersReady(state.draft, tool) || state.busy) return;
  const lock = session.tryBeginSave(memberId);
  if (!lock) return;
  state.busy = true;
  state.status = 'Saving...';
  render();
  try {
    let failed = false;
    let savedId = '';
    try {
      const row = buildInsertRow(memberId, state.draft, state.insight, tool);
      const result = await api.sb.from('journey_reflections').insert(row).select('id');
      savedId = result && result.data && result.data[0] && result.data[0].id;
      if (!result || result.error || !savedId) failed = true;
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
    state.savedId = savedId;
    state.savedTitle = tool.title;
    state.highlightId = savedId;
    state.draft = {};
    state.insight = '';
    state.insightFromModel = false;
    state.toolId = '';
    state.mode = 'saved';
    state.busy = false;
    state.status = '';
    await loadRows();
    if (session.generation() !== lock.sessionGeneration || currentMemberId() !== lock.memberId) return;
    render();
  } finally {
    session.finishSave(lock);
  }
}

async function viewSaved() {
  const id = state.savedId || state.highlightId;
  state.mode = 'home';
  state.highlightId = id;
  state.status = '';
  state.busy = false;
  await loadRows();
  render();
  openReflection(id);
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

function openReflection(id) {
  const card = document.getElementById('reflection-' + id);
  if (!card) return;
  const details = card.querySelector('details');
  if (details) details.open = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearToolParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('tool')) return;
  url.searchParams.delete('tool');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function maybeOpenDeepLink() {
  if (linkHandled || !currentMemberId()) return false;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('tool')) {
    linkHandled = true;
    return false;
  }
  const resolved = resolveToolLink(params.get('tool'));
  window.__nestSkipTourForTool = true;
  clearToolParam();
  linkHandled = true;
  if (!resolved.ok) {
    state.mode = 'home';
    state.toolId = '';
    state.status = 'That exercise is not in the library. Choose one below.';
    host()?.setTab('journey');
    render();
    return true;
  }
  host()?.setTab('journey');
  startTool(resolved.tool.id);
  return true;
}

function onClick(event) {
  const target = event.target.closest('button');
  if (!target || !pane()?.contains(target) && !preview()?.contains(target)) return;
  if ('openJourney' in target.dataset) {
    host()?.setTab('journey');
    return;
  }
  if (!pane()?.contains(target)) return;
  if ('startTool' in target.dataset) startTool(target.dataset.startTool);
  else if ('beginStages' in target.dataset) beginStages();
  else if ('closeExercise' in target.dataset) closeExercise();
  else if ('stageNext' in target.dataset) nextStage();
  else if ('stageBack' in target.dataset) {
    readStage();
    state.stage = Math.max(0, state.stage - 1);
    state.status = '';
    render();
  } else if ('filter' in target.dataset) {
    state.category = target.dataset.filter || 'all';
    state.status = '';
    render();
  } else if ('openCanvas' in target.dataset) host()?.setTab('canvas');
  else if ('reflect' in target.dataset) void reflect();
  else if ('save' in target.dataset) void saveReflection();
  else if ('viewSaved' in target.dataset) void viewSaved();
  else if (target.dataset.deleteReflection) void deleteReflection(target.dataset.deleteReflection);
  else if (target.dataset.openReflection) openReflection(target.dataset.openReflection);
}

function onInput(event) {
  const input = event.target;
  if (!input || !pane()?.contains(input)) return;
  if (input.id === 'journey-search') {
    state.query = input.value.slice(0, 160);
    const box = document.getElementById('journey-library-results');
    if (box) box.innerHTML = libraryResultsHtml();
    return;
  }
  if (input.id === 'journey-recommend') {
    state.recommendText = input.value.slice(0, 400);
    const box = document.getElementById('journey-recommend-results');
    if (box) box.innerHTML = recommendResultsHtml();
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', onInput);

window.LilbirdJourney = {
  async refresh() {
    if (!currentMemberId()) {
      session.invalidate();
      state.rows = [];
      state.mode = 'home';
      state.stage = 0;
      state.toolId = '';
      state.draft = {};
      state.insight = '';
      state.insightFromModel = false;
      state.busy = false;
      state.status = '';
      state.recommendText = '';
      linkHandled = false;
      renderPreview();
      return;
    }
    await loadRows();
    if (maybeOpenDeepLink()) return;
    if (state.mode === 'home') render();
    else renderPreview();
  },
  reset() {
    session.invalidate();
    state.mode = 'home';
    state.stage = 0;
    state.toolId = '';
    state.draft = {};
    state.insight = '';
    state.insightFromModel = false;
    state.rows = [];
    state.status = '';
    state.busy = false;
    state.recommendText = '';
    linkHandled = false;
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
