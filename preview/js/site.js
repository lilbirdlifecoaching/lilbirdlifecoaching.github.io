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

  function initFooterFeedback() {
    var a = document.getElementById('footer-feedback-link');
    if (!a) return;
    var subject = encodeURIComponent("lilbird.life — site feedback");
    var body = encodeURIComponent(
      'What went wrong or what would help?\n\n—\nPage: ' + global.location.href + '\n'
    );
    a.href = 'mailto:hello@lilbird.life?subject=' + subject + '&body=' + body;
  }

  function initCarousel() {
    var track = document.getElementById('carousel-track');
    var dotsContainer = document.getElementById('carousel-dots');
    var prevBtn = document.getElementById('carousel-prev');
    var nextBtn = document.getElementById('carousel-next');
    if (!track || !dotsContainer || !prevBtn || !nextBtn) return;

    var cards = track.querySelectorAll('.testimonial-card');
    var total = cards.length;
    var steps = 0;
    var current = 0;

    function getVisible() {
      var w = global.innerWidth;
      if (w < 640) return 1;
      if (w < 960) return 2;
      if (w < 1240) return 3;
      return 4;
    }

    function gapPx() {
      var n = parseFloat(getComputedStyle(track).gap);
      return Number.isFinite(n) ? n : 20;
    }

    function stepPx() {
      if (!cards.length) return 0;
      return cards[0].offsetWidth + gapPx();
    }

    function buildDots() {
      steps = Math.max(0, total - getVisible());
      dotsContainer.innerHTML = '';
      for (var i = 0; i <= steps; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot' + (i === current ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        (function (idx) {
          dot.addEventListener('click', function () { goTo(idx); });
        })(i);
        dotsContainer.appendChild(dot);
      }
    }

    function goTo(index) {
      current = Math.max(0, Math.min(index, steps));
      var sp = stepPx();
      track.style.transform = sp ? 'translateX(-' + current * sp + 'px)' : 'translateX(0)';
      dotsContainer.querySelectorAll('.carousel-dot').forEach(function (d, i) {
        d.classList.toggle('active', i === current);
      });
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === steps;
    }

    function refresh() {
      current = Math.min(current, Math.max(0, total - getVisible()));
      buildDots();
      goTo(current);
    }

    prevBtn.addEventListener('click', function () { goTo(current - 1); });
    nextBtn.addEventListener('click', function () { goTo(current + 1); });
    buildDots();
    goTo(0);
    var resizeT;
    global.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(refresh, 80);
    });
  }

  function initPathfinder() {
    var layout = document.getElementById('pathfinder-layout');
    if (!layout) return;

    var tiers = layout.querySelectorAll('.pathfinder-tier[data-pathfinder-tier]');
    var visuals = layout.querySelectorAll('.pathfinder-visual');
    var caption = document.getElementById('pathfinder-visual-caption');
    var captions = ['Still deciding', 'Dip your toe in', 'Dive in — one-on-one'];
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

  function boot() {
    initParticles();
    initReveal();
    initBeehiiv();
    initFooterFeedback();
    initCarousel();
    initPathfinder();
    initNavMenu();
    initHeroMotion();
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
