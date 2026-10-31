import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nestPage = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const client = readFileSync(new URL('./nest-client.js', import.meta.url), 'utf8');
const letters = readFileSync(new URL('./nest-letters.sql', import.meta.url), 'utf8');
const claim = readFileSync(new URL('./release-a-hotfix.sql', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('./ownership-recovery.js', import.meta.url), 'utf8');

function section(html, id) {
  const start = html.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, id);
  const end = html.indexOf('</article>', start);
  return html.slice(start, end);
}

test('Nest settings explain closure and ask for the verified address', () => {
  const settings = nestPage.slice(
    nestPage.indexOf('id="nest-settings"'),
    nestPage.indexOf('id="dash-grid"'),
  );
  const closure = section(settings, 'account-closure');
  assert.match(closure, /Close my account/);
  assert.match(closure, /Opening this page does not delete anything/);
  assert.match(closure, /href="mailto:hello@lilbird\.life\?subject=Close%20my%20Nest"/);
  assert.match(closure, /Coaching emails stop/);
  assert.match(closure, /Life Canvas/);
  assert.match(closure, /My Journey/);
  assert.match(closure, /active subscription has to be cancelled/);
  assert.match(closure, /kept for accounting/);
  assert.match(closure, /does not keep an automatic database backup/);
  assert.match(closure, /shared Bridge stays for the other person/);
  assert.match(closure, /do not all disappear when the Nest login closes/);
  assert.doesNotMatch(closure, /deleteUser|account-close|confirm/i);
});

test('the account card opens the request and does not close the login', () => {
  assert.match(client, /id="btn-account-close">Close my account/);
  assert.match(client, /openSettings\('closure'\)/);
  assert.match(client, /location\.hash === '#close-account'/);
  assert.doesNotMatch(client, /\/account-close|closeNest|close-confirm|close my nest/i);
  assert.doesNotMatch(client, /admin\/users|deleteUser/);
});

test('closure copy leaves coaching, the claim, and recovery in place', () => {
  assert.match(letters, /nest_letter_state/);
  assert.match(letters, /references auth\.users \(id\) on delete cascade/);
  assert.doesNotMatch(letters, /account-closure|close my account/i);
  assert.match(claim, /raise exception 'not allowed'/);
  assert.match(claim, /nest_owner_emails/);
  assert.doesNotMatch(claim, /delete from auth\.users/i);
  assert.match(recovery, /RECOVERY_MESSAGE/);
  assert.match(nestPage, /nest-client\.js\?v=58/);
  assert.match(client, /nest-letters/);
});
