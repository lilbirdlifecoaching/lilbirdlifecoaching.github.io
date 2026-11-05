import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const access = require('./lilbird-solo-access.js');

test('direct Solo purchase via purchased_at grants access', () => {
  assert.equal(access.hasSoloCourseAccess({ products: [], purchasedAt: '2026-01-15T00:00:00Z' }), true);
  assert.equal(access.hasSoloCourseAccess({ products: new Set(), purchasedAt: '2026-01-15T00:00:00Z' }), true);
});

test('active solo_course entitlement grants access without purchased_at', () => {
  assert.equal(access.hasSoloCourseAccess({ products: ['solo_course'], purchasedAt: null }), true);
  assert.equal(access.hasSoloCourseAccess({ products: new Set(['solo_course']) }), true);
});

test('active nest_premium grants Solo access (promised Premium include)', () => {
  assert.equal(access.hasSoloCourseAccess({ products: ['nest_premium'], purchasedAt: null }), true);
});

test('Free Nest and Nest Plus alone do not grant Solo', () => {
  assert.equal(access.hasSoloCourseAccess({ products: [], purchasedAt: null }), false);
  assert.equal(access.hasSoloCourseAccess({ products: ['nest_plus'], purchasedAt: null }), false);
  assert.equal(access.hasSoloCourseAccess({ products: ['inner_compass', 'lcs_workbook'], purchasedAt: '' }), false);
  assert.equal(access.soloAccessDenial({ products: ['nest_plus'] }), 'no_solo_entitlement');
});

test('revoked or inactive entitlements are absent from products and deny access', () => {
  // Caller must query active=true only — revoked rows never appear in products.
  assert.equal(access.hasSoloCourseAccess({ products: [], purchasedAt: null }), false);
  assert.equal(access.hasSoloCourseAccess({ products: ['nest_plus'], purchasedAt: null }), false);
});

test('conflicting states: any valid grant wins', () => {
  assert.equal(
    access.hasSoloCourseAccess({
      products: ['nest_plus', 'solo_course'],
      purchasedAt: null,
    }),
    true
  );
  assert.equal(
    access.hasSoloCourseAccess({
      products: ['nest_plus'],
      purchasedAt: '2025-06-01T12:00:00Z',
    }),
    true
  );
});

test('expired Premium is represented as missing nest_premium product', () => {
  assert.equal(access.hasSoloCourseAccess({ products: ['nest_plus'], purchasedAt: null }), false);
});

test('granting product list stays narrow', () => {
  assert.deepEqual(access.GRANTING_PRODUCTS, ['solo_course', 'nest_premium']);
  assert.equal(access.VERSION, 1);
});
