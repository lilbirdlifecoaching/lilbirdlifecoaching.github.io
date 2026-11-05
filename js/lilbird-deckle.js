/* lil' bird — torn-paper (deckle) edges drawn in code.
 *
 * Injects hidden SVG filters that any element can use with
 *   filter: url(#lb-deckle-a)   (or -b / -c for a different tear)
 * The tear is made from noise in screen pixels, so it stays crisp and keeps
 * the same "tooth" at any size or height. No stretched panel images.
 *
 * Load synchronously right after <body> so the filters exist before first paint.
 */
(function () {
  if (document.getElementById('lb-deckle-defs')) return;

  function filter(id, seed, tear) {
    return '' +
      '<filter id="' + id + '" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">' +
        // Torn edge: displace the panel's own edge by low-frequency noise
        '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="' + seed + '" result="tearNoise"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="tearNoise" scale="' + tear + '" xChannelSelector="R" yChannelSelector="G" result="torn"/>' +
        // Warm rim where paper fibres show, just inside the torn edge
        '<feMorphology in="torn" operator="erode" radius="2.5" result="inner"/>' +
        '<feComposite in="torn" in2="inner" operator="out" result="rimMask"/>' +
        '<feGaussianBlur in="rimMask" stdDeviation="1.2" result="rimSoft"/>' +
        '<feFlood flood-color="#a97c3f" flood-opacity="0.42"/>' +
        '<feComposite in2="rimSoft" operator="in" result="rim"/>' +
        // Fine paper grain, clipped to the panel
        '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="' + (seed + 11) + '" result="grainNoise"/>' +
        '<feColorMatrix in="grainNoise" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0 0.18  0 0 0 0.09 0" result="grainTint"/>' +
        '<feComposite in="grainTint" in2="torn" operator="in" result="grain"/>' +
        '<feMerge><feMergeNode in="torn"/><feMergeNode in="grain"/><feMergeNode in="rim"/></feMerge>' +
      '</filter>';
  }

  var svg = '<svg id="lb-deckle-defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" ' +
    'style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' +
    filter('lb-deckle-a', 7, 14) +
    filter('lb-deckle-b', 23, 12) +
    filter('lb-deckle-c', 41, 13) +
    filter('lb-deckle-soft', 5, 7) +
    '</defs></svg>';

  function inject() {
    if (document.getElementById('lb-deckle-defs')) return;
    document.body.insertAdjacentHTML('afterbegin', svg);
    document.documentElement.classList.add('lb-deckle-ready');
  }

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
