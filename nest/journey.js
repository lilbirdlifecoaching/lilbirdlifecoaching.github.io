import {
  answersReady,
  buildInsertRow,
  cleanAnswers,
  fallbackInsight,
  stageValueOk,
} from './journey-reflect.js?v=4';
import { createJourneySession, saveOutcome } from './journey-session.js';
import {
  CHECKIN_RESPONSES,
  FOCUS_FOUND_STATUS,
  FOCUS_MISSING_STATUS,
  MEMBER_CHECKIN_CHOICES,
  NOTE_MAX,
  checkinChoice,
  clipCheckinNote,
  hasNextStep,
  historyLabel,
  isMemberCheckinResponse,
  resolveActiveFocus,
  resolveFocusReflection,
  sortCheckinsNewestFirst,
} from './journey-focus.js?v=2';
import {
  categoryLabel,
  recommendTools,
  reflectionView,
  resolveToolLink,
  searchTools,
  toolById,
} from './journey-tools.js?v=1';

const session = createJourneySession();
let linkHandled = false;

{
  const bootParams = new URLSearchParams(window.location.search);
  if (bootParams.has('tool') || bootParams.has('reflection')) {
    window.__nestSkipTourForTool = true;
  }
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
  checkins: [],
  checkinsUnavailable: false,
  checkinsError: false,
  checkinUi: null,
  status: '',
  busy: false,
  query: '',
  category: '',
  recommendText: '',
};

const AREAS = [
  { id: 'relationships', label: 'Relationships', blurb: 'Boundaries, conversations, and the people close in.', icon: 'ti-heart', tone: 'ember' },
  { id: 'myself', label: 'Myself', blurb: 'The story you tell yourself, and the one you want.', icon: 'ti-feather', tone: 'gold' },
  { id: 'change', label: 'Change & Decisions', blurb: 'A choice that will not sit still.', icon: 'ti-arrows-shuffle', tone: 'tide' },
  { id: 'rhythms', label: 'Life Rhythms', blurb: 'Energy, pace, and the shape of a week.', icon: 'ti-sun', tone: 'green' },
  { id: 'family', label: 'Family', blurb: 'Home, history, and the roles you inherited.', icon: 'ti-home', tone: 'clay' },
  { id: 'work', label: 'Work & Purpose', blurb: 'What the work is asking of you.', icon: 'ti-briefcase', tone: 'violet' },
];

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
    state.checkins = [];
    state.checkinsUnavailable = false;
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
  } else {
    state.rows = result.data || [];
    if (state.status.indexOf('Journey table') === 0) state.status = '';
  }
  await loadCheckins();
}

async function loadCheckins() {
  const api = host();
  const user = api && api.getUser ? api.getUser() : null;
  if (!api || !user?.id) {
    state.checkins = [];
    state.checkinsUnavailable = false;
    state.checkinsError = false;
    return;
  }
  try {
    const result = await api.sb
      .from('journey_checkins')
      .select('id, reflection_id, response, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (result.error) {
      if (result.error.code === '42P01' || /journey_checkins/.test(result.error.message || '')) {
        state.checkinsUnavailable = true;
        state.checkinsError = false;
        state.checkins = [];
        return;
      }
      // Auth / permission / unexpected errors — do not pretend the stream is empty.
      state.checkinsUnavailable = false;
      state.checkinsError = true;
      state.checkins = [];
      if (!state.status) {
        state.status = 'Your check-ins could not be loaded. Your reflections are still here.';
      }
      console.warn('journey checkins:', result.error);
      return;
    }
    state.checkinsUnavailable = false;
    state.checkinsError = false;
    state.checkins = sortCheckinsNewestFirst(result.data || []);
  } catch (e) {
    state.checkinsUnavailable = false;
    state.checkinsError = true;
    state.checkins = [];
    console.warn('journey checkins:', e);
  }
}

function currentFocus() {
  return resolveActiveFocus(state.rows, state.checkins, {
    checkinsUnavailable: state.checkinsUnavailable,
    checkinsError: state.checkinsError,
  });
}

function notifyHostFocus() {
  if (host() && typeof host().refreshJourneySignals === 'function') {
    void host().refreshJourneySignals();
  }
}

function checkinsForReflection(reflectionId) {
  const id = String(reflectionId || '');
  return state.checkins.filter((row) => row && String(row.reflection_id) === id);
}

function renderPreview() {
  const card = preview();
  if (!card) return;
  const focus = currentFocus();
  const latest = focus.status === 'active' ? focus.reflection : null;
  if (!latest) {
    const resting = focus.status === 'resting';
    card.innerHTML = '<p class="sidebar-eyebrow">my journey</p><h4>' +
      (resting ? 'What’s next?' : 'Tools for the Tangle') +
      '</h4><p>' +
      (resting
        ? 'When you’re ready, choose what you’d like to work on next.'
        : 'A short exercise can leave you with one next step. Saving is optional.') +
      '</p><button type="button" class="btn btn-outline full" data-open-journey>Open My Journey</button>';
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

function areaGridHtml() {
  return '<div class="journey-areas">' + AREAS.map((area) => {
    const count = searchTools('', area.id).length;
    const tools = count === 1 ? '1 tool' : count + ' tools';
    return '<button type="button" class="journey-area tone-' + area.tone + '" data-area="' + escapeHtml(area.id) + '">' +
      '<i class="ti ' + area.icon + '" aria-hidden="true"></i>' +
      '<span class="journey-area-label">' + escapeHtml(area.label) + '</span>' +
      '<span class="journey-area-blurb">' + escapeHtml(area.blurb) + '</span>' +
      '<span class="journey-area-count">' + tools + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

function areaHeading(categoryId) {
  const area = AREAS.find((item) => item.id === categoryId);
  const label = area ? area.label : categoryLabel(categoryId);
  return '<div class="journey-area-head"><p class="journey-kicker">' + escapeHtml(label) + '</p>' +
    '<button type="button" class="btn btn-outline" data-area="">All areas</button></div>';
}

function libraryResultsHtml() {
  const q = state.query.trim();
  if (!q && !state.category) return areaGridHtml();
  if (!q && state.category) {
    const found = searchTools('', state.category);
    return areaHeading(state.category) + (found.length
      ? '<div class="journey-tool-grid">' + found.map(toolCardHtml).join('') + '</div>'
      : '<p class="journey-empty">Nothing in this area yet.</p>');
  }
  const found = searchTools(q, 'all');
  if (!found.length) {
    return '<p class="journey-empty">Nothing matches that yet. Try another phrase, or open an area.</p>';
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
    : '<li class="journey-empty">Steps you save will show up here.</li>';

  const reflections = state.rows.length
    ? state.rows.map((row) => reflectionHtml(row)).join('')
    : '<p class="journey-empty">Nothing saved yet. You can finish an exercise and leave it unsaved.</p>';

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
      '<section class="journey-block"><h3>Steps you saved</h3><ul class="journey-steps">' + stepItems + '</ul></section>' +
      '<label class="journey-kicker" for="journey-search">Search</label>' +
      '<input id="journey-search" class="journey-search" type="search" maxlength="160" placeholder="What’s on your mind?" value="' + escapeHtml(state.query) + '">' +
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
  const focus = currentFocus();
  const isActiveFocus = !!(focus.reflection && focus.reflection.id === row.id);
  const focused = state.highlightId === row.id || isActiveFocus;
  const stepLine = '<p class="journey-card-step"><span>Next step</span> ' + escapeHtml(view.nextStep || 'Not named') + '</p>';
  const badge = isActiveFocus ? '<p class="journey-focus-badge">Your current focus</p>' : '';
  return (
    '<article class="journey-reflection' + (focused ? ' is-returning' : '') + (isActiveFocus ? ' is-active-focus' : '') +
      '" id="reflection-' + escapeHtml(row.id) + '"' +
      (focused ? ' aria-current="true"' : '') + '>' +
      '<header><h4>' + escapeHtml(view.title) + '</h4><time>' + escapeHtml(formatWhen(row.created_at)) + '</time></header>' +
      badge +
      stepLine +
      checkinPanelHtml(row, isActiveFocus) +
      '<details' + (focused ? ' open' : '') + '><summary>Open this reflection</summary>' + body + note + '</details>' +
      '<button type="button" class="btn btn-outline" data-delete-reflection="' + escapeHtml(row.id) + '">Delete</button>' +
    '</article>'
  );
}

function checkinHistoryHtml(row) {
  const list = checkinsForReflection(row.id);
  if (!list.length) return '';
  return (
    '<ul class="journey-checkin-history">' +
      list.map((item) => {
        const note = item.note ? '<span class="journey-checkin-note">' + escapeHtml(item.note) + '</span>' : '';
        return '<li><span>' + escapeHtml(formatWhen(item.created_at)) + ' · ' + escapeHtml(historyLabel(item.response)) +
          '</span>' + note + '</li>';
      }).join('') +
    '</ul>'
  );
}

async function insertCheckin(reflectionId, response, note) {
  const api = host();
  const user = api && api.getUser ? api.getUser() : null;
  if (!api || !user?.id || !reflectionId || !response) {
    return { ok: false, error: 'signed-out' };
  }
  const owned = state.rows.some((row) => row && row.id === reflectionId);
  if (!owned) return { ok: false, error: 'forbidden' };
  const row = {
    user_id: user.id,
    reflection_id: reflectionId,
    response,
    note: clipCheckinNote(note),
  };
  try {
    const result = await api.sb.from('journey_checkins').insert(row).select('id, reflection_id, response, note, created_at');
    if (result.error || !result.data || !result.data[0]) {
      return { ok: false, error: result.error || { message: 'insert failed' } };
    }
    return { ok: true, row: result.data[0] };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function beginCheckinPick(reflectionId, response) {
  if (!isMemberCheckinResponse(response) || state.busy) return;
  state.checkinUi = {
    reflectionId,
    response,
    note: '',
    phase: 'note',
    confirm: '',
    cleared: false,
  };
  state.status = '';
  render();
  const input = document.getElementById('journey-checkin-note');
  if (input) input.focus();
}

async function finishCheckin(reflectionId, withNote) {
  const ui = state.checkinUi;
  if (!ui || ui.reflectionId !== reflectionId || state.busy) return;
  const choice = checkinChoice(ui.response);
  if (!choice) return;
  let note = null;
  if (withNote) {
    const input = document.getElementById('journey-checkin-note');
    note = clipCheckinNote(input ? input.value : ui.note);
  }
  state.busy = true;
  state.status = 'Saving...';
  render();
  const saved = await insertCheckin(reflectionId, ui.response, note);
  state.busy = false;
  if (!saved.ok) {
    state.status = 'That check-in could not be saved. Try again when you are ready.';
    render();
    return;
  }
  await loadCheckins();
  const cleared = ui.response === CHECKIN_RESPONSES.CHANGED || ui.response === CHECKIN_RESPONSES.DONE_FOR_NOW;
  state.checkinUi = {
    reflectionId,
    response: ui.response,
    note: note || '',
    phase: 'done',
    confirm: choice.confirm,
    cleared,
  };
  state.status = '';
  if (cleared) state.highlightId = reflectionId;
  else state.highlightId = reflectionId;
  render();
  notifyHostFocus();
  openReflection(reflectionId);
}

async function chooseAgain(reflectionId) {
  if (!reflectionId || state.busy) return;
  const row = state.rows.find((item) => item && item.id === reflectionId);
  if (!row || !hasNextStep(row)) return;
  if (!window.confirm('Make this your current next step?')) return;
  state.busy = true;
  state.status = 'Saving...';
  render();
  const saved = await insertCheckin(reflectionId, CHECKIN_RESPONSES.CHOOSE_AGAIN, null);
  state.busy = false;
  if (!saved.ok) {
    state.status = 'That could not be saved. Try again when you are ready.';
    render();
    return;
  }
  await loadCheckins();
  state.checkinUi = null;
  state.highlightId = reflectionId;
  state.status = 'This is your current next step again.';
  render();
  notifyHostFocus();
  openReflection(reflectionId);
}

function checkinPanelHtml(row, isActiveFocus) {
  if (state.checkinsUnavailable) return '';
  const ui = state.checkinUi && state.checkinUi.reflectionId === row.id ? state.checkinUi : null;
  const history = checkinHistoryHtml(row);
  const canChooseAgain = !isActiveFocus && hasNextStep(row);

  if (ui && ui.phase === 'done') {
    return (
      '<div class="journey-checkin" id="checkin-' + escapeHtml(row.id) + '">' +
        '<p class="journey-checkin-confirm" role="status">' + escapeHtml(ui.confirm || '') + '</p>' +
        (ui.cleared
          ? '<button type="button" class="btn btn-outline" data-checkin-explore>Choose what matters next</button>'
          : '<button type="button" class="btn btn-outline" data-checkin-again="' + escapeHtml(row.id) + '">Check in again</button>') +
        history +
      '</div>'
    );
  }

  if (ui && ui.phase === 'note') {
    const choice = checkinChoice(ui.response);
    return (
      '<div class="journey-checkin" id="checkin-' + escapeHtml(row.id) + '">' +
        '<p class="journey-lead">' + escapeHtml(choice ? choice.notePrompt : 'Anything you want to add?') + '</p>' +
        '<p class="journey-empty">Optional. You can skip this.</p>' +
        '<textarea id="journey-checkin-note" class="journey-checkin-note-input" rows="3" maxlength="' + NOTE_MAX + '" placeholder="A few words is enough.">' +
          escapeHtml(ui.note || '') +
        '</textarea>' +
        '<div class="journey-actions">' +
          '<button type="button" class="btn btn-gold" data-checkin-save="' + escapeHtml(row.id) + '"' + (state.busy ? ' disabled' : '') + '>Save</button>' +
          '<button type="button" class="btn btn-outline" data-checkin-skip="' + escapeHtml(row.id) + '"' + (state.busy ? ' disabled' : '') + '>Skip for now</button>' +
        '</div>' +
        history +
      '</div>'
    );
  }

  if (isActiveFocus) {
    const buttons = MEMBER_CHECKIN_CHOICES.map((item) =>
      '<button type="button" class="btn btn-outline journey-checkin-choice" data-checkin-pick="' +
        escapeHtml(item.response) + '" data-reflection-id="' + escapeHtml(row.id) + '">' +
        escapeHtml(item.label) + '</button>'
    ).join('');
    return (
      '<div class="journey-checkin" id="checkin-' + escapeHtml(row.id) + '">' +
        '<p class="journey-kicker">gentle check-in</p>' +
        '<p class="journey-lead">Last time, this felt important to you. How has it been going?</p>' +
        '<div class="journey-checkin-choices">' + buttons + '</div>' +
        history +
      '</div>'
    );
  }

  if (canChooseAgain) {
    return (
      '<div class="journey-checkin journey-checkin-muted">' +
        history +
        '<button type="button" class="btn btn-outline" data-choose-again="' + escapeHtml(row.id) + '"' +
          (state.busy ? ' disabled' : '') + '>Choose this again</button>' +
      '</div>'
    );
  }

  return history ? '<div class="journey-checkin journey-checkin-muted">' + history + '</div>' : '';
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
    ? '<div class="journey-note"><span>' + (state.insightFromModel ? 'Coaching note' : 'A note you can keep') + '</span><p>' + escapeHtml(state.insight) + '</p><p class="journey-empty">A new perspective changes this note. Reflections you already saved stay saved. Saving this one adds another entry.</p></div>'
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
  if (state.highlightId === id) state.highlightId = '';
  if (state.checkinUi && state.checkinUi.reflectionId === id) state.checkinUi = null;
  state.status = 'Deleted.';
  await loadCheckins();
  render();
  notifyHostFocus();
}

function scrollToReflectionCard(card) {
  if (!card) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
}

function openReflection(id) {
  const card = document.getElementById('reflection-' + id);
  if (!card) return;
  const details = card.querySelector('details');
  if (details) details.open = true;
  card.classList.add('is-returning');
  card.setAttribute('aria-current', 'true');
  scrollToReflectionCard(card);
}

/**
 * Open My Journey on a specific saved reflection (Home "Return to my next step").
 * Falls back to the Journey home list when the id is missing or deleted.
 */
async function focusReflection(preferredId, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const announce = opts.announce !== false;
  if (!currentMemberId()) {
    host()?.setTab('journey');
    return { status: 'none' };
  }

  host()?.setTab('journey');
  state.mode = 'home';
  state.toolId = '';
  state.stage = 0;
  state.draft = {};
  state.insight = '';
  state.insightFromModel = false;
  state.busy = false;
  state.savedId = '';
  state.savedTitle = '';

  await loadRows();
  // Resolve only against rows already scoped to the signed-in member (RLS + user_id filter).
  const resolved = resolveFocusReflection(state.rows, preferredId);

  if (resolved.status === 'found') {
    state.highlightId = resolved.reflection.id;
    state.status = announce ? FOCUS_FOUND_STATUS : '';
    render();
    openReflection(resolved.reflection.id);
    return resolved;
  }

  state.highlightId = '';
  if (resolved.status === 'missing' || resolved.status === 'invalid') {
    // Same copy for deleted, foreign, and malformed ids — no existence leak.
    state.status = FOCUS_MISSING_STATUS;
  } else {
    state.status = announce ? 'Open a saved reflection below, or begin a new exercise.' : '';
  }
  render();
  const list = document.getElementById('journey-reflections');
  if (list) scrollToReflectionCard(list);
  return resolved;
}

function clearJourneyParams(keys) {
  const url = new URL(window.location.href);
  let changed = false;
  (keys || []).forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function maybeOpenDeepLink() {
  if (linkHandled || !currentMemberId()) return false;
  const params = new URLSearchParams(window.location.search);
  const reflectionId = params.get('reflection');
  const toolParam = params.get('tool');

  if (!reflectionId && !toolParam) {
    linkHandled = true;
    return false;
  }

  window.__nestSkipTourForTool = true;
  clearJourneyParams(['tool', 'reflection']);
  linkHandled = true;

  if (reflectionId) {
    // Malformed / foreign ids resolve to the same safe fallback inside focusReflection.
    void focusReflection(reflectionId, { announce: true });
    return true;
  }

  const resolved = resolveToolLink(toolParam);
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
  } else if ('area' in target.dataset) {
    state.category = target.dataset.area || '';
    state.query = '';
    state.status = '';
    render();
  } else if ('openCanvas' in target.dataset) host()?.setTab('canvas');
  else if ('reflect' in target.dataset) void reflect();
  else if ('save' in target.dataset) void saveReflection();
  else if ('viewSaved' in target.dataset) void viewSaved();
  else if (target.dataset.deleteReflection) void deleteReflection(target.dataset.deleteReflection);
  else if (target.dataset.openReflection) {
    state.highlightId = target.dataset.openReflection;
    state.checkinUi = null;
    render();
    openReflection(target.dataset.openReflection);
  } else if (target.dataset.checkinPick) {
    beginCheckinPick(target.dataset.reflectionId, target.dataset.checkinPick);
  } else if (target.dataset.checkinSave) void finishCheckin(target.dataset.checkinSave, true);
  else if (target.dataset.checkinSkip) void finishCheckin(target.dataset.checkinSkip, false);
  else if (target.dataset.checkinAgain) {
    state.checkinUi = null;
    state.highlightId = target.dataset.checkinAgain;
    render();
    openReflection(target.dataset.checkinAgain);
  } else if ('checkinExplore' in target.dataset) {
    state.checkinUi = null;
    state.status = '';
    render();
    const tools = document.getElementById('journey-library-results');
    if (tools) scrollToReflectionCard(tools);
  } else if (target.dataset.chooseAgain) void chooseAgain(target.dataset.chooseAgain);
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
  if (input.id === 'journey-checkin-note' && state.checkinUi) {
    state.checkinUi.note = input.value.slice(0, NOTE_MAX);
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', onInput);

window.LilbirdJourney = {
  async refresh() {
    if (!currentMemberId()) {
      session.invalidate();
      state.rows = [];
      state.checkins = [];
      state.checkinsUnavailable = false;
      state.checkinsError = false;
      state.checkinUi = null;
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
    state.checkins = [];
    state.checkinsUnavailable = false;
    state.checkinsError = false;
    state.checkinUi = null;
    state.status = '';
    state.busy = false;
    state.recommendText = '';
    linkHandled = false;
    const el = pane();
    if (el) el.innerHTML = '';
    const card = preview();
    if (card) card.innerHTML = '';
  },
  currentFocus() {
    return currentFocus();
  },
  show() {
    if (state.mode === 'home') render();
  },
  openTool(toolId) {
    host()?.setTab('journey');
    startTool(toolId);
  },
  focusReflection(preferredId, options) {
    return focusReflection(preferredId, options);
  },
};

document.dispatchEvent(new Event('lilbird-journey-ready'));
