/**
 * Nest lil' bird guided tour — spotlight coachmarks on live UI.
 * First visit: welcome video, then tour. Replay video via What is Nest?; tour via Take a tour.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'lilbird-nest-tour-v1';
  var VIDEO_KEY = 'lilbird-nest-welcome-video-v1';
  var SEEN_KEY = 'lilbird-nest-seen-access';
  var WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  var PAD = 10;
  var root = null;
  var hole = null;
  var card = null;
  var videoRoot = null;
  var stepIndex = 0;
  var steps = [];
  var running = false;
  var videoOpen = false;
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

  function videoSeen() {
    try {
      return localStorage.getItem(VIDEO_KEY) === 'done';
    } catch (e) {
      return false;
    }
  }

  function markVideoSeen() {
    try {
      localStorage.setItem(VIDEO_KEY, 'done');
    } catch (e) { /* ignore */ }
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
          body: 'Life Canvas, Relationship Dynamic, and the Roots & Wings workbook are here. The First Flight workbook is already in your free Nest.',
          tip: '» Open Roots & Wings when you’re ready'
        };
      },
      locked: {
        title: 'Nest Plus · $7.99/month',
        body: 'Adds Life Canvas, the full Inner Compass read, Relationship Dynamic, and the Roots & Wings workbook. $7.99 a month. Cancel anytime from your Nest. Included with coaching or the Intensive.',
        tip: null,
        action: { label: 'Add Nest Plus · $7.99/month →', upgrade: 'nest_plus' }
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
        body: 'The complete eight-session workbook to work through on your own. It’s included with the Life Change Intensive.',
        tip: null,
        action: { label: 'Get the workbook · $27 →', upgrade: 'lcs_workbook' }
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
        body: 'Eight self-guided sessions with an AI coaching guide. Unlock it from this card. Nest Plus is separate.',
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
        body: 'Start with a First Flight session ($149), book a single coaching session ($249), or enrol in the Life Change Intensive, all from these cards.',
        tip: '» Pick the card that fits'
      }
    }
  };

  function productStep(key, mode) {
    var def = PRODUCT_STEPS[key];
    if (!def) return null;
    var copy = mode === 'owned' ? def.owned() : def.locked;
    return { id: key, tab: 'products', selector: def.selector, title: copy.title, body: copy.body, tip: copy.tip, action: copy.action || null };
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
        id: 'canvas',
        tab: 'canvas',
        selector: '#tab-canvas',
        title: 'Life Canvas',
        body: 'Passion, connections, spaces, resources, and energy live on this tab. Check in again and the history graph updates here.',
        tip: null
      },
      {
        id: 'profile',
        tab: 'profile',
        selector: '#tab-profile',
        title: 'Inner Compass',
        body: owns('full_read')
          ? 'Your full Inner Compass read lives here. Life Canvas has its own tab.'
          : 'Your Inner Compass lives here. Your two types are free; the full read and Nest unlock for $2 from your read.',
        tip: '» Complete or open Inner Compass from this tab'
      },
      {
        id: 'younger',
        tab: 'profile',
        selector: '.younger-you-card',
        title: 'A picture of little you',
        body: 'Add a photo of you around ages 4–8. It becomes your Nest picture, and it’s a fun one to dig out.',
        tip: null,
        action: { label: 'Choose a photo →', photo: true }
      },
      {
        id: 'ask',
        tab: 'ask',
        selector: '#tab-ask',
        title: 'Ask lil’ bird',
        body: 'Stuck or curious? Ask the same guide anything about your work, right here in your Nest.',
        tip: null
      },
      {
        id: 'done',
        tab: 'products',
        selector: '#btn-nest-tour',
        title: 'You’re set',
        body: 'That’s the lay of the land. Replay this tour anytime from Take a tour, or watch What is Nest? again whenever you like.',
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
      '  <button type="button" class="btn btn-ember nest-tour-action hidden" id="nest-tour-action"></button>' +
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
    document.getElementById('nest-tour-action').addEventListener('click', function () {
      var step = steps[stepIndex];
      var action = step && step.action;
      if (!action) return;
      endTour(true);
      if (action.upgrade) {
        var btn = document.querySelector('#pane-products [data-upgrade="' + action.upgrade + '"]');
        if (btn) btn.click();
      } else if (action.photo) {
        setTab('profile');
        var label = document.querySelector('.younger-you-file-label');
        if (label) label.click();
      }
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
        var actionEl = document.getElementById('nest-tour-action');
        if (step.action) {
          actionEl.textContent = step.action.label;
          actionEl.classList.remove('hidden');
        } else {
          actionEl.textContent = '';
          actionEl.classList.add('hidden');
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

  async function fetchWelcomeVideoUrl() {
    var headers = { 'Content-Type': 'application/json' };
    if (typeof window.__nestWorkerAuthHeaders === 'function') {
      try {
        var auth = await window.__nestWorkerAuthHeaders();
        if (auth && auth.Authorization) headers.Authorization = auth.Authorization;
      } catch (e) { /* ignore */ }
    }
    var res = await fetch(WORKER_URL + '/nest-welcome-video-url', {
      method: 'POST',
      headers: headers,
      body: '{}'
    });
    if (!res.ok) throw new Error('Could not load welcome video');
    var data = await res.json();
    if (!data || !data.url) throw new Error('Could not load welcome video');
    return data.url;
  }

  function ensureVideoDom() {
    if (videoRoot) return videoRoot;
    videoRoot = document.createElement('div');
    videoRoot.id = 'nest-welcome-video-root';
    videoRoot.className = 'nest-welcome-video-root hidden';
    videoRoot.setAttribute('role', 'dialog');
    videoRoot.setAttribute('aria-modal', 'true');
    videoRoot.setAttribute('aria-labelledby', 'nest-welcome-video-title');
    videoRoot.innerHTML =
      '<div class="nest-welcome-video-backdrop" data-welcome-close></div>' +
      '<div class="nest-welcome-video-panel">' +
      '  <p class="nest-welcome-video-kicker">lil’ bird</p>' +
      '  <h2 class="nest-welcome-video-title" id="nest-welcome-video-title">Welcome to your Nest</h2>' +
      '  <p class="nest-welcome-video-body">A short look at the habitat you’re in — and how to use it.</p>' +
      '  <div class="nest-welcome-video-frame">' +
      '    <video id="nest-welcome-video" controls playsinline preload="metadata"></video>' +
      '    <p class="nest-welcome-video-status" id="nest-welcome-video-status">Loading video…</p>' +
      '  </div>' +
      '  <div class="nest-welcome-video-actions">' +
      '    <button type="button" class="btn btn-outline" data-welcome-close>Skip</button>' +
      '    <button type="button" class="btn btn-gold" id="nest-welcome-video-continue" data-welcome-close>Continue</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(videoRoot);
    videoRoot.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-welcome-close') !== null) {
        closeWelcomeVideo();
      }
    });
    return videoRoot;
  }

  function closeWelcomeVideo() {
    if (!videoOpen) return;
    videoOpen = false;
    markVideoSeen();
    var after = videoRoot && videoRoot._afterClose;
    if (videoRoot) {
      videoRoot._afterClose = null;
      videoRoot.classList.add('hidden');
      var vid = document.getElementById('nest-welcome-video');
      if (vid) {
        try { vid.pause(); } catch (e) { /* ignore */ }
        vid.removeAttribute('src');
        try { vid.load(); } catch (e2) { /* ignore */ }
      }
    }
    document.body.classList.remove('nest-welcome-video-active');
    document.removeEventListener('keydown', onVideoKey);
    if (typeof after === 'function') {
      setTimeout(after, 200);
    }
  }

  function onVideoKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeWelcomeVideo();
    }
  }

  function showWelcomeVideo(opts) {
    opts = opts || {};
    if (videoOpen || running) return Promise.resolve();
    ensureVideoDom();
    videoOpen = true;
    videoRoot._afterClose = typeof opts.after === 'function' ? opts.after : null;
    videoRoot.classList.remove('hidden');
    document.body.classList.add('nest-welcome-video-active');
    document.addEventListener('keydown', onVideoKey);

    var status = document.getElementById('nest-welcome-video-status');
    var vid = document.getElementById('nest-welcome-video');
    var continueBtn = document.getElementById('nest-welcome-video-continue');
    if (status) {
      status.textContent = 'Loading video…';
      status.classList.remove('hidden');
    }
    if (continueBtn) continueBtn.textContent = opts.continueLabel || 'Continue';

    return fetchWelcomeVideoUrl().then(function (url) {
      if (!videoOpen || !vid) return;
      vid.src = url;
      if (status) status.classList.add('hidden');
      var playPromise = vid.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () { /* autoplay blocked — controls still work */ });
      }
      vid.onended = function () {
        if (continueBtn) continueBtn.focus();
      };
    }).catch(function () {
      if (status) {
        status.textContent = 'Couldn’t load the video just now. Continue to explore your Nest.';
        status.classList.remove('hidden');
      }
    });
  }

  function maybeAutoStart() {
    if (window.__nestSkipTourForTool) return;
    if (running || videoOpen) return;
    var params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '0') return;
    if (autoAttempted) return;
    autoAttempted = true;

    setTimeout(function () {
      if (!document.getElementById('view-dashboard') || !document.getElementById('view-dashboard').classList.contains('active')) return;
      if (running || videoOpen) return;

      function startTourIfNeeded() {
        if (isDone()) {
          maybeWhatsNew();
          return;
        }
        startTour({ auto: true });
      }

      if (!videoSeen()) {
        showWelcomeVideo({ after: startTourIfNeeded, continueLabel: 'Take the tour →' });
        return;
      }
      startTourIfNeeded();
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
    if (btn && !btn.dataset.tourBound) {
      btn.dataset.tourBound = '1';
      btn.addEventListener('click', function () {
        startTour({ force: true });
      });
    }
    var welcomeBtn = document.getElementById('btn-nest-welcome');
    if (welcomeBtn && !welcomeBtn.dataset.welcomeBound) {
      welcomeBtn.dataset.welcomeBound = '1';
      welcomeBtn.addEventListener('click', function () {
        showWelcomeVideo({ continueLabel: 'Close' });
      });
    }
  }

  window.LilBirdNestTour = {
    start: startTour,
    startForced: startForced,
    maybeAutoStart: maybeAutoStart,
    showWelcomeVideo: showWelcomeVideo,
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
