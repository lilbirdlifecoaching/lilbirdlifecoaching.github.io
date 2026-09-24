/**
 * Nest lil' bird guided tour — spotlight coachmarks on live UI.
 * Auto-starts once per browser after first Nest hydrate; replay via Take a tour.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'lilbird-nest-tour-v1';
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

  function buildSteps() {
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
        id: 'products',
        tab: 'products',
        selector: '#tab-products',
        title: 'My products',
        body: 'Everything you own lives on this tab — Inner Compass, Solo, First Flight, Intensive, and more.',
        tip: '» Open a card when you’re ready to continue'
      }
    ];

    var lci = document.querySelector('[data-product="life_change_intensive"]:not(.locked)');
    if (lci) {
      list.push({
        id: 'intensive',
        tab: 'products',
        selector: '[data-product="life_change_intensive"]',
        title: 'Book your Intensive sessions',
        body: 'Your Nest tracks all 8. Book one at a time, then open the workbook before you meet Luke.',
        tip: '» Tap Book your next session when you’re ready'
      });
    } else {
      list.push({
        id: 'book-with-luke',
        tab: 'products',
        selector: '#pane-products',
        title: 'Book with Luke from here',
        body: 'First Flight ($149), a single coaching session ($249), or enrol in the Life Change Intensive — all from My products.',
        tip: '» Pick the card that fits'
      });
    }

    var solo = document.querySelector('[data-product="solo_course"]:not(.locked)');
    if (solo) {
      list.push({
        id: 'solo',
        tab: 'products',
        selector: '[data-product="solo_course"]',
        title: 'Continue Solo here',
        body: 'Your self-guided course progress shows on this card. Jump back in whenever you’re ready.',
        tip: '» Continue from the Solo card'
      });
    }

    list.push(
      {
        id: 'profile',
        tab: 'profile',
        selector: '#tab-profile',
        title: 'My profile',
        body: 'Your Inner Compass read (and Life Canvas once you’ve taken it) lives here — the wiring everything else builds on.',
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
    steps = buildSteps();
    if (!steps.length) return;

    running = true;
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    showStep(0);
  }

  function maybeAutoStart() {
    if (autoAttempted || running || isDone()) return;
    var params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '0') return;
    autoAttempted = true;
    // slight delay so Nest UI finishes painting
    setTimeout(function () {
      if (!document.getElementById('view-dashboard') || !document.getElementById('view-dashboard').classList.contains('active')) return;
      if (isDone() || running) return;
      startTour({ auto: true });
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
