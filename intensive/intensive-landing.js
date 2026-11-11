(function () {
  document.documentElement.classList.remove('no-js');
  var fallback = document.querySelector('.lci-movement-fallback');
  if (fallback) fallback.setAttribute('hidden', '');

  var DISCOVERY = '/book.html#discovery';

  /* —— Is this you? —— */
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-fit-chip]'));
  var countEl = document.getElementById('fit-count');
  var cardEl = document.getElementById('fit-card');
  var fitRevealed = false;

  function updateFit() {
    var n = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).length;
    if (!countEl) return;
    if (n === 0) countEl.textContent = 'Nothing to get right here. Just notice what lands.';
    else if (n === 1) countEl.textContent = 'One so far. Anything else?';
    else countEl.textContent = n + ' of 5. You are not the only one.';

    if (cardEl) {
      var open = n >= 2;
      cardEl.classList.toggle('is-open', open);
      cardEl.hidden = !open;
      if (open && !fitRevealed) {
        fitRevealed = true;
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'intensive_fit_revealed', fit_count: n });
        } catch (e) {}
      }
    }
  }

  chips.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', on ? 'false' : 'true');
      var mark = btn.querySelector('.lci-chip-mark');
      if (mark) mark.textContent = on ? '' : '✓';
      updateFit();
    });
  });
  updateFit();

  /* —— Movement tabs —— */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-movement-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-movement-panel]'));

  function selectMovement(index) {
    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (panel, i) {
      var on = i === index;
      panel.hidden = !on;
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectMovement(i); });
    tab.addEventListener('keydown', function (e) {
      var next = i;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      else return;
      e.preventDefault();
      selectMovement(next);
      tabs[next].focus();
    });
  });
  if (tabs.length) selectMovement(0);

  /* —— Price toggle —— */
  var payFull = document.getElementById('pay-full');
  var payPlan = document.getElementById('pay-plan');
  var priceMain = document.getElementById('price-main');
  var priceSub = document.getElementById('price-sub');
  var enrolBtn = document.getElementById('enrol-cta');

  function setPlan(plan) {
    var full = plan === 'full';
    if (payFull) payFull.setAttribute('aria-pressed', full ? 'true' : 'false');
    if (payPlan) payPlan.setAttribute('aria-pressed', full ? 'false' : 'true');
    if (priceMain) priceMain.textContent = full ? '$4,999' : '$1,799';
    if (priceSub) priceSub.textContent = full ? 'one payment' : 'a month, for 3 months';
    if (enrolBtn) {
      enrolBtn.textContent = full ? 'Enrol — pay in full' : 'Enrol — 3 payments';
      enrolBtn.href = full ? '/intensive/enrol.html?plan=full' : '/intensive/enrol.html?plan=three';
    }
  }

  if (payFull) payFull.addEventListener('click', function () { setPlan('full'); });
  if (payPlan) payPlan.addEventListener('click', function () { setPlan('plan'); });
  setPlan('full');

  /* —— FAQ accordion —— */
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-faq-item]'));

  function openFaq(index) {
    items.forEach(function (item, i) {
      var on = i === index;
      var btn = item.querySelector('[data-faq-q]');
      var ans = item.querySelector('[data-faq-a]');
      var sign = item.querySelector('[data-faq-sign]');
      item.classList.toggle('is-open', on);
      if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (ans) ans.hidden = !on;
      if (sign) sign.textContent = on ? '−' : '+';
    });
  }

  items.forEach(function (item, i) {
    var btn = item.querySelector('[data-faq-q]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = item.classList.contains('is-open');
      openFaq(open ? -1 : i);
    });
  });
  if (items.length) openFaq(0);

  /* —— Reveal on scroll —— */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.lci-reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* Keep discovery anchors consistent if needed */
  void DISCOVERY;
})();
