import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = process.env.NEST_FIXTURE_PORT || '18941';
const BASE = `http://127.0.0.1:${PORT}/nest/phase1b-world-fixture.html`;

const shots = [
  ['01-desktop-day', 'returning', 'continue', 'light', 1440, 980, false],
  ['02-desktop-night', 'returning', 'continue', 'dark', 1440, 980, false],
  ['03-mobile-day', 'returning', 'continue', 'light', 390, 844, true],
  ['04-mobile-night', 'returning', 'continue', 'dark', 390, 844, true],
  ['05-desktop-solo-rail', 'returning', 'continue', 'light', 1440, 980, false],
  ['06-mobile-solo-tab', 'returning', 'continue', 'light', 390, 844, true],
  ['07-solo-start', 'returning', 'start', 'light', 1440, 980, false],
  ['08-solo-continue', 'returning', 'continue', 'light', 1440, 980, false],
  ['09-solo-complete', 'returning', 'complete', 'light', 1440, 980, false],
  ['10-nonowner-locked', 'returning', 'off', 'light', 1440, 980, false],
  ['11-tablet-1024', 'returning', 'continue', 'light', 1024, 900, false],
  ['12-narrow-360', 'returning', 'continue', 'light', 360, 780, true],
  ['13-mobile-new-day', 'new', 'off', 'light', 390, 844, true],
  ['14-desktop-new-day', 'new', 'off', 'light', 1440, 980, false],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--font-render-hinting=none'],
});

const page = await browser.newPage();
const overflows = [];

for (const [name, member, solo, theme, w, h, mobile] of shots) {
  await page.setViewport({
    width: w,
    height: h,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const url = `${BASE}?member=${member}&solo=${solo}&theme=${theme}&hide-banner=1&v=p1b`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => {
    const b = document.getElementById('fixture-banner');
    if (b) b.style.display = 'none';
  });
  await new Promise((r) => setTimeout(r, 350));
  const metrics = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  if (metrics.overflow) {
    overflows.push({ name, ...metrics });
    console.warn('OVERFLOW', name, metrics);
  } else {
    console.log('ok', name, metrics.inner + 'px');
  }
  await page.screenshot({ path: path.join(OUT, name + '.png'), type: 'png' });
}

await browser.close();
if (overflows.length) {
  console.error('overflow count', overflows.length);
  process.exitCode = 1;
}
console.log('done', fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length, 'pngs');
