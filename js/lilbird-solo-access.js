/**
 * Shared Solo Course access policy for Nest UI, Solo shell, and (when pasted) worker-solo.
 *
 * Grants access when ANY of these is true for the signed-in member:
 *   - user_entitlements.product = solo_course AND active
 *   - user_entitlements.product = nest_premium AND active
 *   - course_users.purchased_at is set (legacy / Stripe purchase row)
 *
 * Does NOT grant for Free Nest, Nest Plus alone, Inner Compass, workbooks, etc.
 * Revoked/expired entitlements must be omitted from `products` (query active=true only).
 *
 * Client checks are UX only. Chat, video, and summarise must use the same rule on the Worker.
 */
(function (root) {
  'use strict';

  var VERSION = 1;
  var GRANTING_PRODUCTS = Object.freeze(['solo_course', 'nest_premium']);

  function productSet(products) {
    if (!products) return null;
    if (typeof products.has === 'function') return products;
    if (Array.isArray(products)) {
      var set = new Set();
      products.forEach(function (p) {
        if (p) set.add(String(p));
      });
      return set;
    }
    return null;
  }

  function hasGrantingProduct(products) {
    var set = productSet(products);
    if (!set) return false;
    for (var i = 0; i < GRANTING_PRODUCTS.length; i += 1) {
      if (set.has(GRANTING_PRODUCTS[i])) return true;
    }
    return false;
  }

  function hasPurchasedAt(purchasedAt) {
    if (purchasedAt == null || purchasedAt === false) return false;
    if (purchasedAt === true) return true;
    var s = String(purchasedAt).trim();
    return s.length > 0 && s !== 'null' && s !== 'undefined';
  }

  /**
   * @param {{ products?: Set<string>|string[], purchasedAt?: string|null }} input
   */
  function hasSoloCourseAccess(input) {
    var opts = input && typeof input === 'object' ? input : {};
    if (hasGrantingProduct(opts.products)) return true;
    if (hasPurchasedAt(opts.purchasedAt)) return true;
    return false;
  }

  /**
   * Explain denial for tests and soft UI copy. Not shown to members by default.
   */
  function soloAccessDenial(input) {
    if (hasSoloCourseAccess(input)) return null;
    return 'no_solo_entitlement';
  }

  root.LilbirdSoloAccess = {
    VERSION: VERSION,
    GRANTING_PRODUCTS: GRANTING_PRODUCTS,
    hasSoloCourseAccess: hasSoloCourseAccess,
    hasPurchasedAt: hasPurchasedAt,
    hasGrantingProduct: hasGrantingProduct,
    soloAccessDenial: soloAccessDenial,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LilbirdSoloAccess;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
