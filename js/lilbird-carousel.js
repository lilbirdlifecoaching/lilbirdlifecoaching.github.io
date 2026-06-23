/**
 * lil' bird — testimonial carousel (homepage + about-luke)
 */
(function (global) {
  'use strict';

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

  global.LilbirdCarousel = { init: initCarousel };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousel);
  } else {
    initCarousel();
  }
})(window);
