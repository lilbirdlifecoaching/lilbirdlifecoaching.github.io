/**
 * lil' bird day/night — site interactions (particles, carousel, pathfinder, etc.)
 */
(function (global) {
  var particleRoot = null;
  var reduceMotion =
    global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clearParticles() {
    if (particleRoot) particleRoot.innerHTML = '';
  }

  function spawnParticles(theme) {
    if (!particleRoot || reduceMotion) return;
    clearParticles();
    var count = theme === 'light' ? 14 : 18;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      var isLight = theme === 'light';
      p.className = 'particle ' + (isLight ? 'seed' : 'ember');
      if (!isLight && Math.random() > 0.6) p.classList.add('hot');
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * (isLight ? 10 : 14)) + 's';
      p.style.animationDelay = (Math.random() * 12) + 's';
      if (!isLight) {
        var size = 1 + Math.random() * 2.5;
        p.style.width = p.style.height = size + 'px';
      }
      particleRoot.appendChild(p);
    }
  }

  function initParticles() {
    particleRoot = document.getElementById('particles');
    var theme =
      (global.LilbirdTheme && global.LilbirdTheme.getTheme()) ||
      document.documentElement.getAttribute('data-theme') ||
      'dark';
    spawnParticles(theme);
    global.addEventListener('lilbird-theme-change', function (e) {
      spawnParticles(e.detail.theme);
    });
  }

  function initReveal() {
    try {
      if (global.location.protocol === 'https:' || global.location.protocol === 'http:') {
        document.body.classList.add('js-reveal-ready');
        var obs = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) entry.target.classList.add('visible');
            });
          },
          { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );
        document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
      }
    } catch (_) {}
  }

  function initBeehiiv() {
    var slot = document.getElementById('beehiiv-slot');
    var section = document.querySelector('.newsletter-section');
    var fallback = document.getElementById('beehiiv-fallback');
    if (!slot) return;

    var loaded = false;
    var BEEHIIV_URL = 'https://subscribe-forms.beehiiv.com/8d432d00-8b5d-4842-aca7-682776d54c79';

    function showFallback() {
      if (fallback) fallback.hidden = false;
    }

    function loadBeehiiv() {
      if (loaded) return;
      loaded = true;
      var placeholder = slot.querySelector('.beehiiv-placeholder');
      if (placeholder) placeholder.remove();
      slot.innerHTML = '';

      var iframe = document.createElement('iframe');
      iframe.className = 'beehiiv-embed';
      iframe.setAttribute('data-test-id', 'beehiiv-embed');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.title = 'Newsletter signup';
      iframe.src = BEEHIIV_URL;
      slot.appendChild(iframe);

      var s1 = document.createElement('script');
      s1.async = true;
      s1.src = 'https://subscribe-forms.beehiiv.com/embed.js';
      s1.onerror = showFallback;
      document.head.appendChild(s1);

      var s2 = document.createElement('script');
      s2.async = true;
      s2.src = 'https://subscribe-forms.beehiiv.com/attribution.js';
      document.head.appendChild(s2);

      global.setTimeout(function () {
        if (!slot.querySelector('iframe')) showFallback();
      }, 9000);
    }

    function isNearViewport(el, margin) {
      var r = el.getBoundingClientRect();
      return r.top < global.innerHeight + margin && r.bottom > -margin;
    }

    var watchEl = section || slot;
    var obs = null;

    function tryLoadIfVisible() {
      if (loaded) return true;
      if (isNearViewport(watchEl, 220)) {
        loadBeehiiv();
        if (obs) obs.disconnect();
        return true;
      }
      return false;
    }

    if (tryLoadIfVisible()) return;

    if ('IntersectionObserver' in global) {
      obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              loadBeehiiv();
              obs.disconnect();
            }
          });
        },
        { root: null, rootMargin: '220px 0px', threshold: 0.01 }
      );
      obs.observe(watchEl);
    } else {
      loadBeehiiv();
      return;
    }

    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(tryLoadIfVisible);
    });
    global.addEventListener('load', tryLoadIfVisible);
    global.addEventListener(
      'scroll',
      function onScrollBeehiiv() {
        if (tryLoadIfVisible()) global.removeEventListener('scroll', onScrollBeehiiv);
      },
      { passive: true }
    );
  }

  function initLetterPosts() {
    var wrap = document.querySelector('.journal-preview');
    if (!wrap || !global.fetch) return;
    global
      .fetch('https://lilbird-assessment.cwwq46sn7m.workers.dev/letter-posts')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        var posts = json && Array.isArray(json.posts) ? json.posts : [];
        if (!posts.length) return;
        wrap.innerHTML = '';
        posts.forEach(function (p) {
          if (!p || !p.title || !/^https:\/\//.test(p.url || '')) return;
          var a = document.createElement('a');
          a.className = 'journal-preview-card';
          a.href = p.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          var cat = document.createElement('span');
          cat.className = 'journal-preview-cat';
          cat.textContent = p.date
            ? new Date(p.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'From the letter';
          var title = document.createElement('span');
          title.className = 'journal-preview-title';
          title.textContent = p.title;
          a.appendChild(cat);
          a.appendChild(title);
          wrap.appendChild(a);
        });
      })
      .catch(function () {});
  }

  function initFooterFeedback() {
    var a = document.getElementById('footer-feedback-link');
    if (!a) return;
    var subject = encodeURIComponent("lilbird.life site feedback");
    var body = encodeURIComponent(
      'What went wrong or what would help?\n\n—\nPage: ' + global.location.href + '\n'
    );
    a.href = 'mailto:hello@lilbird.life?subject=' + subject + '&body=' + body;
  }

  function initPathfinder() {
    var layout = document.getElementById('pathfinder-layout');
    if (!layout) return;

    var tiers = layout.querySelectorAll('.pathfinder-tier[data-pathfinder-tier]');
    var visuals = layout.querySelectorAll('.pathfinder-visual');
    var caption = document.getElementById('pathfinder-visual-caption');
    var captions = [
      'Stage one · First Flight',
      'Stage two · Coaching',
      'Stage three · Life Change Intensive'
    ];
    var activeIdx = '0';
    var observer = null;

    function isDesktop() {
      return global.matchMedia('(min-width: 961px)').matches;
    }

    function setVisual(idx) {
      if (idx === activeIdx) return;
      activeIdx = idx;
      visuals.forEach(function (img) {
        img.classList.toggle('is-active', img.getAttribute('data-pathfinder-visual') === idx);
      });
      tiers.forEach(function (tier) {
        tier.classList.toggle('is-visual-active', tier.getAttribute('data-pathfinder-tier') === idx);
      });
      if (caption && captions[parseInt(idx, 10)]) caption.textContent = captions[parseInt(idx, 10)];
    }

    function teardown() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    function setup() {
      teardown();
      if (!isDesktop() || !tiers.length || !visuals.length || !('IntersectionObserver' in global)) return;

      var visibility = new Map();
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visibility.set(entry.target, entry.intersectionRatio);
          });
          var bestTier = null;
          var bestRatio = 0;
          tiers.forEach(function (tier) {
            var ratio = visibility.get(tier) || 0;
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestTier = tier;
            }
          });
          if (bestTier && bestRatio >= 0.12) {
            setVisual(bestTier.getAttribute('data-pathfinder-tier'));
          }
        },
        { root: null, rootMargin: '-8% 0px -32% 0px', threshold: [0, 0.1, 0.2, 0.35, 0.55, 0.75] }
      );
      tiers.forEach(function (tier) { observer.observe(tier); });
    }

    setup();
    global.addEventListener('resize', function () {
      clearTimeout(initPathfinder._rt);
      initPathfinder._rt = setTimeout(setup, 120);
    });
  }

  function initNavMenu() {
    var nav = document.getElementById('site-nav');
    var btn = document.getElementById('nav-menu-btn');
    var panel = document.getElementById('nav-menu-panel');
    if (!nav || !btn || !panel) return;

    function setOpen(open) {
      nav.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    }

    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('menu-open'));
    });
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('menu-open')) setOpen(false);
    });
    global.addEventListener('resize', function () {
      if (global.innerWidth > 768 && nav.classList.contains('menu-open')) setOpen(false);
    });
  }

  function initNavDropdowns() {
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll('.nav-dropdown'));
    if (!dropdowns.length) return;

    function closeAll(except) {
      dropdowns.forEach(function (wrap) {
        if (except && wrap === except) return;
        var btn = wrap.querySelector('.nav-dropdown-btn');
        var panel = wrap.querySelector('.nav-dropdown-panel');
        wrap.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (panel) panel.setAttribute('hidden', '');
      });
    }

    dropdowns.forEach(function (wrap) {
      var btn = wrap.querySelector('.nav-dropdown-btn');
      var panel = wrap.querySelector('.nav-dropdown-panel');
      if (!btn || !panel) return;

      function setOpen(open) {
        if (open) closeAll(wrap);
        wrap.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(panel.hasAttribute('hidden'));
      });
      panel.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { setOpen(false); });
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-dropdown')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  function bindPixelHotspots(stage, options) {
    if (!stage) return;
    options = options || {};
    var targets = Array.prototype.slice.call(stage.querySelectorAll('.art-hotspot'));
    var glowMap = {};
    stage.querySelectorAll('.hotspot-glow').forEach(function (img) {
      glowMap[img.getAttribute('data-glow')] = { img: img, canvas: null, ctx: null };
    });
    var activeKey = null;
    var activeTarget = null;

    function ensureHit(key) {
      var g = glowMap[key];
      if (!g) return null;
      if (g.ctx) return g;
      if (g.loading) return null;
      var hitSrc = g.img.getAttribute('data-hit') || g.img.currentSrc || g.img.src;
      g.loading = true;
      var hitImg = new Image();
      hitImg.decoding = 'async';
      hitImg.onload = function () {
        var w = hitImg.naturalWidth;
        var h = hitImg.naturalHeight;
        if (!w || !h) { g.loading = false; return; }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(hitImg, 0, 0);
        g.canvas = canvas;
        g.ctx = ctx;
        g.loading = false;
      };
      hitImg.onerror = function () { g.loading = false; };
      hitImg.src = hitSrc;
      return null;
    }

    function clearLit() {
      Object.keys(glowMap).forEach(function (key) {
        glowMap[key].img.classList.remove('is-lit');
      });
      targets.forEach(function (t) { t.classList.remove('is-active'); });
    }

    function setActive(key, target) {
      if (activeKey === key && activeTarget === target) {
        if (options.onActivate) options.onActivate(target, key, false);
        return;
      }
      clearLit();
      activeKey = key;
      activeTarget = target || null;
      stage.classList.toggle('is-hot', !!key);
      if (!key) {
        if (options.onClear) options.onClear();
        return;
      }
      if (glowMap[key]) glowMap[key].img.classList.add('is-lit');
      if (target) target.classList.add('is-active');
      if (options.onActivate) options.onActivate(target, key, true);
    }

    function hitKey(clientX, clientY) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      var nx = (clientX - rect.left) / rect.width;
      var ny = (clientY - rect.top) / rect.height;
      for (var i = targets.length - 1; i >= 0; i--) {
        var target = targets[i];
        var key = target.getAttribute('data-glow');
        var g = ensureHit(key);
        if (!g || !g.ctx) continue;
        var px = Math.floor(nx * g.canvas.width);
        var py = Math.floor(ny * g.canvas.height);
        if (px < 0 || py < 0 || px >= g.canvas.width || py >= g.canvas.height) continue;
        if (g.ctx.getImageData(px, py, 1, 1).data[3] > 28) return { key: key, target: target };
      }
      return null;
    }

    function targetByKey(key) {
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].getAttribute('data-glow') === key) return targets[i];
      }
      return null;
    }

    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var hit = hitKey(e.clientX, e.clientY);
      if (hit) setActive(hit.key, hit.target);
      else if (document.activeElement && stage.contains(document.activeElement) && document.activeElement.classList.contains('art-hotspot')) {
        /* keep keyboard focus highlight */
      } else {
        setActive(null, null);
      }
    });
    stage.addEventListener('pointerleave', function () {
      if (document.activeElement && stage.contains(document.activeElement) && document.activeElement.classList.contains('art-hotspot')) return;
      setActive(null, null);
    });
    stage.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.rock-pop, .tree-tip-pop')) return;
      var hit = hitKey(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      setActive(hit.key, hit.target);
      if (options.onClick) options.onClick(hit.target, hit.key);
    });

    targets.forEach(function (target) {
      target.addEventListener('focus', function () {
        setActive(target.getAttribute('data-glow'), target);
      });
      target.addEventListener('blur', function () {
        if (activeTarget === target) setActive(null, null);
      });
      target.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        setActive(target.getAttribute('data-glow'), target);
        if (options.onClick) options.onClick(target, target.getAttribute('data-glow'));
      });
    });

    // Warm canvases once images decode
    Object.keys(glowMap).forEach(function (key) {
      var img = glowMap[key].img;
      if (img.complete) ensureHit(key);
      else img.addEventListener('load', function () { ensureHit(key); });
    });

    return {
      clear: function () { setActive(null, null); },
      activate: function (key) { setActive(key, targetByKey(key)); }
    };
  }

  function initRockHotspots() {
    var stage = document.getElementById('rocks-stage');
    var frame = stage && stage.querySelector('.rocks-art-frame');
    var pop = document.getElementById('rock-pop');
    var tip = document.getElementById('rock-tip');
    if (!stage || !frame || !pop) return;

    var ROCKS = {
      '1': {
        label: 'Uncertainty',
        kicker: 'One of the rocks',
        phrase: 'I know something needs to change. I just can\'t name what.',
        href: '/articles/how-do-you-know-youre-ready-for-life-coaching.html'
      },
      '2': {
        label: 'Overthinking',
        kicker: 'One of the rocks',
        phrase: 'I keep having the same conversations with myself and going nowhere.',
        href: '/articles/stuck-between-two-paths.html'
      },
      '3': {
        label: 'Disconnection',
        kicker: 'One of the rocks',
        phrase: 'On paper, my life looks fine. From the inside, it doesn\'t feel like mine.',
        href: '/articles/on-paper-my-life-looks-fine.html'
      },
      '4': {
        label: 'Feeling stuck',
        kicker: 'One of the rocks',
        phrase: 'I\'m not in crisis. I\'m just stuck. And I\'m tired of it.',
        href: '/articles/feeling-stuck-in-your-late-twenties.html'
      }
    };

    var paths = Array.prototype.slice.call(stage.querySelectorAll('.rock-path'));
    var phraseEl = document.getElementById('rock-pop-phrase');
    var kickerEl = document.getElementById('rock-pop-kicker');
    var linkEl = document.getElementById('rock-pop-link');
    var closeBtn = pop.querySelector('[data-rock-close]');
    var activeId = null;
    var lastTrigger = null;

    if (/(?:^|[?&])rocks-debug=1(?:&|$)/.test(location.search)) {
      document.documentElement.classList.add('rocks-debug');
    }

    function placeOver(el, path) {
      var frameRect = frame.getBoundingClientRect();
      var rockRect = path.getBoundingClientRect();
      el.style.left = (((rockRect.left + rockRect.width / 2 - frameRect.left) / frameRect.width) * 100) + '%';
      el.style.top = (((rockRect.top - frameRect.top) / frameRect.height) * 100) + '%';
    }

    function clearActive() {
      paths.forEach(function (p) { p.classList.remove('is-active'); });
    }

    function hideTip() {
      if (tip) tip.hidden = true;
    }

    function showTip(path, data) {
      if (!tip || !data) return;
      tip.textContent = data.label;
      placeOver(tip, path);
      tip.hidden = false;
    }

    function closePop() {
      pop.hidden = true;
      clearActive();
      activeId = null;
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        try { lastTrigger.focus(); } catch (err) {}
      }
    }

    function openRock(id, trigger) {
      var data = ROCKS[id];
      var path = stage.querySelector('#rock-' + id);
      if (!data || !path) return;
      lastTrigger = trigger || path;
      clearActive();
      path.classList.add('is-active');
      activeId = id;
      if (kickerEl) kickerEl.textContent = data.kicker;
      if (phraseEl) phraseEl.textContent = data.phrase;
      if (linkEl) linkEl.setAttribute('href', data.href);
      placeOver(pop, path);
      hideTip();
      pop.hidden = false;
      if (closeBtn) closeBtn.focus();
    }

    paths.forEach(function (path) {
      var id = path.getAttribute('data-rock');
      path.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        showTip(path, ROCKS[id]);
      });
      path.addEventListener('pointerleave', function () {
        hideTip();
      });
      path.addEventListener('focus', function () {
        showTip(path, ROCKS[id]);
      });
      path.addEventListener('blur', function () {
        hideTip();
      });
      path.addEventListener('click', function () {
        if (activeId === id && !pop.hidden) {
          var href = ROCKS[id] && ROCKS[id].href;
          if (href) global.location.href = href;
          return;
        }
        openRock(id, path);
      });
      path.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openRock(id, path);
      });
    });

    stage.querySelectorAll('.rocks-fallback-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openRock(btn.getAttribute('data-rock'), btn);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closePop);
    document.addEventListener('click', function (e) {
      if (!stage.contains(e.target)) closePop();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePop();
    });

    // One-shot intro pulse when the stage enters the viewport
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && 'IntersectionObserver' in global) {
      var played = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || played) return;
          played = true;
          io.disconnect();
          paths.forEach(function (path, i) {
            global.setTimeout(function () {
              path.classList.add('is-intro');
              global.setTimeout(function () { path.classList.remove('is-intro'); }, 420);
            }, i * 220);
          });
        });
      }, { threshold: 0.35 });
      io.observe(stage);
    }
  }

  function initTreeHotspots() {
    var stage = document.getElementById('nest-tree-stage');
    var pop = document.getElementById('tree-tip-pop');
    if (!stage || !pop) return;
    var title = document.getElementById('tree-tip-title');
    var body = document.getElementById('tree-tip-body');

    function placeTip(target) {
      if (title) title.textContent = target.getAttribute('data-title') || '';
      if (body) body.textContent = target.getAttribute('data-body') || '';
      var stageRect = stage.getBoundingClientRect();
      var tipRect = target.getBoundingClientRect();
      pop.style.left = (((tipRect.left + tipRect.width / 2 - stageRect.left) / stageRect.width) * 100) + '%';
      pop.style.top = (((tipRect.top - stageRect.top) / stageRect.height) * 100) + '%';
      pop.hidden = false;
    }

    bindPixelHotspots(stage, {
      onActivate: function (target) {
        if (!target) {
          pop.hidden = true;
          return;
        }
        placeTip(target);
      },
      onClear: function () { pop.hidden = true; }
    });
  }

  function initHeroMotion() {
    if (global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var hero = document.querySelector('.hero');
    var art = document.querySelector('.hero-art');
    if (!hero || !art) return;

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      global.requestAnimationFrame(function () {
        var rect = hero.getBoundingClientRect();
        var progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.85)));
        art.style.transform = 'translateY(' + (progress * 28) + 'px)';
        ticking = false;
      });
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initQuoteTicker() {
    var track = document.querySelector('.quote-ticker-track');
    if (!track || track.getAttribute('data-ticker-ready') === '1') return;
    var items = Array.prototype.slice.call(track.children);
    if (!items.length) return;
    items.forEach(function (item) {
      var clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
    track.setAttribute('data-ticker-ready', '1');
  }

  function boot() {
    initParticles();
    initReveal();
    initBeehiiv();
    initLetterPosts();
    initFooterFeedback();
    initPathfinder();
    initNavMenu();
    initNavDropdowns();
    initRockHotspots();
    initTreeHotspots();
    initHeroMotion();
    initQuoteTicker();
  }

  global.LilbirdSite = {
    boot: boot,
    refreshParticles: spawnParticles,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
