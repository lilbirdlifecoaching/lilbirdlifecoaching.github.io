/**
 * Keeps Supabase auth in sync across lilbird.life pages (Nest, Solo, Deep Profile).
 * Uses one storage key: lilbird-solo-auth (same Supabase project).
 */
(function () {
  var KEY = 'lilbird-solo-auth';
  var LEGACY_NEST = 'lilbird-nest-auth';

  try {
    if (!localStorage.getItem(KEY) && localStorage.getItem(LEGACY_NEST)) {
      localStorage.setItem(KEY, localStorage.getItem(LEGACY_NEST));
    }
  } catch (e) {
    console.warn('lilbird-auth-bridge:', e);
  }
})();
