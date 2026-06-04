/**
 * Boots Google Tag Manager using window.LILBIRD_GTM_ID from lilbird-gtm-id.js.
 * Load both scripts in <head> as early as possible (after charset/viewport).
 */
(function () {
  var id = window.LILBIRD_GTM_ID;
  if (!id || id.indexOf('GTM-') !== 0) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn("lil' bird GTM: set window.LILBIRD_GTM_ID in /lilbird-gtm-id.js");
    }
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(script, first);
  } else {
    document.head.appendChild(script);
  }
})();
