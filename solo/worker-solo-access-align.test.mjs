/**
 * Mirrors worker-solo userHasSoloAccess decision + asserts the iCloud source
 * was patched to the shared Solo policy (solo_course | nest_premium | purchased_at).
 *
 * Does not deploy. Live Worker must still show v1.32 until approved deploy of v1.33.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const access = require('../js/lilbird-solo-access.js');

const ICLOUD_WORKER = path.join(
  process.env.HOME || '',
  "Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird site/solo/worker-solo.js"
);

/** Same OR-logic the Worker applies after REST filters active + product in (...). */
function workerDecision({ activeProducts, purchasedAt }) {
  return access.hasSoloCourseAccess({
    products: activeProducts || [],
    purchasedAt: purchasedAt || null,
  });
}

test('Worker decision matrix matches shared helper', () => {
  const cases = [
    { activeProducts: [], purchasedAt: '2026-01-01', expect: true, label: 'purchase only' },
    { activeProducts: ['solo_course'], purchasedAt: null, expect: true, label: 'solo_course only' },
    { activeProducts: ['nest_premium'], purchasedAt: null, expect: true, label: 'Premium only (no purchased_at)' },
    { activeProducts: ['nest_plus'], purchasedAt: null, expect: false, label: 'Nest Plus alone' },
    { activeProducts: [], purchasedAt: null, expect: false, label: 'Free Nest' },
    { activeProducts: ['nest_premium'], purchasedAt: '2025-01-01', expect: true, label: 'Premium + purchase' },
    { activeProducts: [], purchasedAt: '2025-01-01', expect: true, label: 'purchase survives missing Premium' },
    { activeProducts: ['solo_course', 'nest_plus'], purchasedAt: null, expect: true, label: 'solo + plus conflict' },
  ];
  for (const c of cases) {
    assert.equal(workerDecision(c), c.expect, c.label);
  }
});

test('iCloud worker-solo.js is patched for nest_premium + version bump', () => {
  assert.ok(fs.existsSync(ICLOUD_WORKER), 'expected iCloud worker-solo.js at known path');
  const src = fs.readFileSync(ICLOUD_WORKER, 'utf8');
  assert.match(src, /const WORKER_VERSION = 'v1\.33-solo-access-align'/);
  assert.match(
    src,
    /user_entitlements\?user_id=eq\.\$\{userId\}&active=eq\.true&product=in\.\(solo_course,nest_premium\)/
  );
  assert.match(src, /async function userHasSoloAccess\(userId, env\)/);
  // Protected Solo routes still gate on userHasSoloAccess
  assert.match(src, /pathname === '\/chat'[\s\S]*userHasSoloAccess/);
  assert.match(src, /pathname === '\/solo-video-url'[\s\S]*userHasSoloAccess|userHasSoloAccess[\s\S]*solo-video-url/);
  assert.doesNotMatch(
    src,
    /user_entitlements\?user_id=eq\.\$\{userId\}&product=eq\.solo_course&active=eq\.true/
  );
});
