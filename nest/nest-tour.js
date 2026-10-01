/**
 * Nest lil' bird guided tour — spotlight coachmarks on live UI.
 * Auto-starts once per browser after first Nest hydrate; replay via Take a tour.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'lilbird-nest-tour-v1';
  var SEEN_KEY = 'lilbird-nest-seen-access';
  var PAD = 10;
  var root = null;
  var hole = null;
  var card = null;
  var stepIndex = 0;
  var steps = [];
  var running = false;
  var resizeTimer = null;
  var autoAttempted = false;

  function storageGet() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storageSet(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch (e) { /* ignore */ }
  }

  function markDone() {
    storageSet('done');
  }

  function isDone() {
    return storageGet() === 'done';
  }

  function setTab(name) {
    if (typeof window.__nestSetTab === 'function') {
      window.__nestSetTab(name);
      return;
    }
    var tab = document.getElementById('tab-' + name);
    if (tab) tab.click();
  }

  function access() {
    return window.__nestAccess || { owned: [], plan: 'Nest', nestPlusSource: '', workbookSource: '' };
  }

  function owns(key) {
    return access().owned.indexOf(key) !== -1;
  }

  var PRODUCT_STEPS = {
    nest_plus: {
      selector: '[data-product="nest_plus"]',
      owned: function () {
        var src = access().nestPlusSource;
        return {
          title: 'Nest Plus' + (src && src !== 'Nest Plus' ? ' · ' + src.toLowerCase() : ''),
          body: 'Open the Relationship Dynamic to see how you and someone close to you fit together. Your First Flight workbook is here too.',
          tip: '» Tap Relationship Dynamic to start'
        };
      },
      locked: {
        title: 'Nest Plus · $5',
        body: 'Adds the Relationship Dynamic tool and the First Flight workbook. A one-off $5, unlocked right here on this card. Already included with any coaching, Solo or Intensive purchase.',
        tip: '» Add Nest Plus from this card'
      }
    },
    lcs_workbook: {
      selector: '[data-product="lcs_workbook"]',
      owned: function () {
        return {
          title: 'Your Life Change workbook',
          body: 'All eight sessions in one interactive workbook. Answers save on this device, and Download as PDF keeps a copy.',
          tip: '» Open workbook when you’re ready'
        };
      },
      locked: {
        title: 'Life Change Sessions workbook · $27',
        body: 'The complete eight-session workbook to work through on your own. Get it from this card; it’s included with the Life Change Intensive.',
        tip: null
      }
    },
    solo_course: {
      selector: '[data-product="solo_course"]',
      owned: function () {
        return {
          title: 'Continue Solo here',
          body: 'Your self-guided course progress shows on this card. Jump back in whenever you’re ready.',
          tip: '» Continue from the Solo card'
        };
      },
      locked: {
        title: 'Life Change Sessions: Solo · $197',
        body: 'Eight self-guided sessions with an AI coaching guide. Unlock it from this card; it includes Nest Plus.',
        tip: null
      }
    },
    life_change_intensive: {
      selector: '[data-product="life_change_intensive"]',
      owned: function () {
        return {
          title: 'Book your Intensive sessions',
          body: 'Your Nest tracks all 8. Book one at a time, then open the workbook before you meet Luke. Your Intensive includes everything in the Nest.',
          tip: '» Tap Book your next session when you’re ready'
        };
      },
      locked: {
        title: 'Work with Luke',
        body: 'Start with a First Flight session ($149), book a single coaching session ($249), or enrol in the Life Change Intensive — all from these cards.',
        tip: '» Pick the card that fits'
      }
    }
  };

  function productStep(key, mode) {
    var def = PRODUCT_STEPS[key];
    if (!def) return null;
    var copy = mode === 'owned' ? def.owned() : def.locked;
    return { id: key, tab: 'products', selector: def.selector, title: copy.title, body: copy.body, tip: copy.tip };
  }

  function buildSteps() {
    var plan = access().plan;
    var list = [
      {
        id: 'welcome',
        tab: 'products',
        selector: '.next-steps-banner',
        title: 'This is your Nest',
        body: 'One home for what you’ve unlocked and what to do next. Start with the checklist up here.',
        tip: null
      },
      {
        id: 'plan',
        tab: 'products',
        selector: '.plan-badge',
        title: 'Your plan: ' + plan,
        body: plan === 'Intensive'
          ? 'Your Intensive includes everything in the Nest, so every card below is open to you.'
          : 'This shows what your Nest includes. Locked cards say what they are, what they cost and where to unlock them.',
        tip: null
      }
    ];

    ['life_change_intensive', 'nest_plus', 'lcs_workbook', 'solo_course'].forEach(function (key) {
      var step = productStep(key, owns(key) ? 'owned' : 'locked');
      if (step) list.push(step);
    });

    list.push(
      {
        id: 'profile',
        tab: 'profile',
        selector: '#tab-profile',
        title: 'My profile',
        body: owns('full_read')
          ? 'Your full Inner Compass read and Life Canvas live here — the wiring everything else builds on.'
          : 'Your Inner Compass lives here. Your two types are free; the full read and Nest unlock for $2 from your read.',
        tip: '» Complete or open Inner Compass from this tab'
      },
      {
        id: 'younger',
        tab: 'profile',
        selector: '.younger-you-card',
        title: 'Nest picture',
        body: 'Upload or change a photo of you around ages 4–8 right here in My profile. It becomes your Nest avatar.',
        tip: '» Choose a photo, then Save'
      },
      {
        id: 'ask',
        tab: 'ask',
        selector: '#tab-ask',
        title: 'Ask lil’ bird',
        body: 'Stuck or curious? Same guide voice, inside your Nest — ask anything about your work here.',
        tip: null
      },
      {
        id: 'done',
        tab: 'products',
        selector: '#btn-nest-tour',
        title: 'You’re set',
        body: 'That’s the lay of the land. Replay this tour anytime from Take a tour.',
        tip: null
      }
    );

    return list.filter(function (s) {
      return !!document.querySelector(s.selector);
    });
  }

  /** One-time steps for access gained since this browser last saw the Nest. */
  function buildWhatsNewSteps(newKeys) {
    var list = [];
    newKeys.forEach(function (key) {
      var step = productStep(key, 'owned');
      if (step) {
        step.title = 'New: ' + step.title;
        list.push(step);
      }
    });
    return list.filter(function (s) {
      return !!document.querySelector(s.selector);
    });
  }

  function readSeen() {
    try {
      var raw = localStorage.getItem(SEEN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSeen(list) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'nest-tour-root';
    root.className = 'nest-tour-root hidden';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', "lil' bird Nest tour");
    root.innerHTML =
      '<div class="nest-tour-backdrop" aria-hidden="true"></div>' +
      '<div class="nest-tour-hole" id="nest-tour-hole" aria-hidden="true"></div>' +
      '<div class="nest-tour-card" id="nest-tour-card">' +
      '  <div class="nest-tour-bird" aria-hidden="true">🪶</div>' +
      '  <p class="nest-tour-kicker">lil’ bird</p>' +
      '  <h3 class="nest-tour-title" id="nest-tour-title"></h3>' +
      '  <p class="nest-tour-body" id="nest-tour-body"></p>' +
      '  <p class="nest-tour-tip hidden" id="nest-tour-tip"></p>' +
      '  <div class="nest-tour-actions">' +
      '    <button type="button" class="btn btn-outline nest-tour-skip" data-tour-skip>Skip</button>' +
      '    <span class="nest-tour-progress" id="nest-tour-progress"></span>' +
      '    <button type="button" class="btn btn-gold" id="nest-tour-next">Next →</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(root);
    hole = document.getElementById('nest-tour-hole');
    card = document.getElementById('nest-tour-card');

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-tour-skip]')) {
        endTour(true);
      }
    });
    document.getElementById('nest-tour-next').addEventListener('click', function () {
      goNext();
    });
  }

  function positionHole(el) {
    if (!el || !hole) return;
    var r = el.getBoundingClientRect();
    var top = Math.max(8, r.top - PAD);
    var left = Math.max(8, r.left - PAD);
    var width = Math.min(window.innerWidth - left - 8, r.width + PAD * 2);
    var height = Math.min(window.innerHeight - top - 8, r.height + PAD * 2);
    hole.style.top = top + 'px';
    hole.style.left = left + 'px';
    hole.style.width = Math.max(40, width) + 'px';
    hole.style.height = Math.max(40, height) + 'px';
  }

  function positionCard(el) {
    if (!card) return;
    card.style.visibility = 'hidden';
    card.classList.remove('is-below', 'is-above');
    var cardH = card.offsetHeight || 220;
    var cardW = Math.min(340, window.innerWidth - 24);
    card.style.width = cardW + 'px';

    var preferBelow = true;
    var left = 16;
    var top = 16;

    if (el) {
      var r = el.getBoundingClientRect();
      left = Math.min(Math.max(12, r.left), window.innerWidth - cardW - 12);
      if (r.bottom + 16 + cardH < window.innerHeight - 12) {
        top = r.bottom + 14;
        preferBelow = true;
      } else if (r.top - 14 - cardH > 12) {
        top = r.top - 14 - cardH;
        preferBelow = false;
      } else {
        top = Math.max(12, Math.min(window.innerHeight - cardH - 12, r.bottom + 14));
        preferBelow = true;
      }
    } else {
      left = Math.max(12, (window.innerWidth - cardW) / 2);
      top = Math.max(12, window.innerHeight * 0.28);
    }

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.classList.add(preferBelow ? 'is-below' : 'is-above');
    card.style.visibility = 'visible';
  }

  function showStep(i) {
    stepIndex = i;
    var step = steps[i];
    if (!step) {
      endTour(true);
      return;
    }

    if (step.tab) setTab(step.tab);

    requestAnimationFrame(function () {
      var el = document.querySelector(step.selector);
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          el.scrollIntoView(true);
        }
      }

      setTimeout(function () {
        el = document.querySelector(step.selector);
        document.getElementById('nest-tour-title').textContent = step.title;
        document.getElementById('nest-tour-body').textContent = step.body;
        var tipEl = document.getElementById('nest-tour-tip');
        if (step.tip) {
          tipEl.textContent = step.tip;
          tipEl.classList.remove('hidden');
        } else {
          tipEl.textContent = '';
          tipEl.classList.add('hidden');
        }
        document.getElementById('nest-tour-progress').textContent =
          i + 1 + ' / ' + steps.length;
        var nextBtn = document.getElementById('nest-tour-next');
        nextBtn.textContent = i === steps.length - 1 ? 'Done →' : 'Next →';

        positionHole(el);
        positionCard(el);
        root.classList.remove('hidden');
        document.body.classList.add('nest-tour-active');
      }, 80);
    });
  }

  function goNext() {
    if (stepIndex >= steps.length - 1) {
      endTour(true);
      return;
    }
    showStep(stepIndex + 1);
  }

  function onKey(e) {
    if (!running) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      endTour(true);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      goNext();
    }
  }

  function onResize() {
    if (!running) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var step = steps[stepIndex];
      if (!step) return;
      var el = document.querySelector(step.selector);
      positionHole(el);
      positionCard(el);
    }, 80);
  }

  function endTour(mark) {
    running = false;
    if (mark) markDone();
    if (root) root.classList.add('hidden');
    document.body.classList.remove('nest-tour-active');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
    setTab('products');
  }

  function startTour(opts) {
    opts = opts || {};
    if (running) return;
    ensureDom();
    steps = opts.steps || buildSteps();
    writeSeen(access().owned);
    if (!steps.length) return;

    running = true;
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    showStep(0);
  }

  function maybeAutoStart() {
    if (running) return;
    var params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '0') return;
    if (isDone()) {
      maybeWhatsNew();
      return;
    }
    if (autoAttempted) return;
    autoAttempted = true;
    // slight delay so Nest UI finishes painting
    setTimeout(function () {
      if (!document.getElementById('view-dashboard') || !document.getElementById('view-dashboard').classList.contains('active')) return;
      if (isDone() || running) return;
      startTour({ auto: true });
    }, 700);
  }

  function maybeWhatsNew() {
    var seen = readSeen();
    var owned = access().owned;
    if (!seen) {
      writeSeen(owned);
      return;
    }
    var fresh = owned.filter(function (k) { return seen.indexOf(k) === -1 && PRODUCT_STEPS[k]; });
    if (!fresh.length) {
      if (owned.length !== seen.length) writeSeen(owned);
      return;
    }
    setTimeout(function () {
      if (running) return;
      var list = buildWhatsNewSteps(fresh);
      if (list.length) startTour({ steps: list });
      else writeSeen(owned);
    }, 700);
  }

  function startForced() {
    if (running) return;
    autoAttempted = true;
    startTour({ force: true });
  }

  function bindReplayButton() {
    var btn = document.getElementById('btn-nest-tour');
    if (!btn || btn.dataset.tourBound) return;
    btn.dataset.tourBound = '1';
    btn.addEventListener('click', function () {
      startTour({ force: true });
    });
  }

  window.LilBirdNestTour = {
    start: startTour,
    startForced: startForced,
    maybeAutoStart: maybeAutoStart,
    bindReplayButton: bindReplayButton,
    isDone: isDone,
    markDone: markDone
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindReplayButton);
  } else {
    bindReplayButton();
  }
})();
