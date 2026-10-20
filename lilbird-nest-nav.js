/**
 * Reveal Nest back links only when this browser already has a Nest login.
 * Markup: <a href="/nest/" id="nav-back-nest" class="lilbird-nav-nest" hidden>← back to your Nest</a>
 */
(function () {
  var IDS = ['nav-back-nest', 'nav-back-nest-session', 'topbar-back-nest'];

  function hasNestSession() {
    try {
      var raw = localStorage.getItem('lilbird-solo-auth');
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data && (data.access_token || (data.currentSession && data.currentSession.access_token))) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function showNestBackLinks() {
    if (!hasNestSession()) return;
    IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('hidden');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showNestBackLinks);
  } else {
    showNestBackLinks();
  }
})();
