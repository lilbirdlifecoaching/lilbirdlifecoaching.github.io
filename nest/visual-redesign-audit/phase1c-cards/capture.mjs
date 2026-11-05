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
  ['03-mobile-day-390', 'returning', 'continue', 'light', 390, 844, true],
  ['04-mobile-night-390', 'returning', 'continue', 'dark', 390, 844, true],
  ['05-mobile-day-360', 'returning', 'continue', 'light', 360, 780, true],
  ['06-mobile-night-360', 'returning', 'continue', 'dark', 360, 780, true],
  ['07-nonowner-desktop-day', 'returning', 'off', 'light', 1440, 980, false],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--font-render-hinting=none'],
});

const page = await browser.newPage();

for (const [name, member, solo, theme, w, h, mobile] of shots) {
  await page.setViewport({
    width: w,
    height: h,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const url = `${BASE}?member=${member}&solo=${solo}&theme=${theme}&hide-banner=1&v=p1c5`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => {
    const b = document.getElementById('fixture-banner');
    if (b) b.style.display = 'none';
  });
  await new Promise((r) => setTimeout(r, 400));

  const styles = await page.evaluate(() => {
    const chapter = document.querySelector('.next-chapter');
    const rail = document.querySelector('.nest-rail');
    const pageEl = document.querySelector('.nest-page.nest-world');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const pick = (s) =>
      s
        ? {
            bgImage: s.backgroundImage.slice(0, 180),
            bgSize: s.backgroundSize,
            bgRepeat: s.backgroundRepeat,
            mask: s.maskImage || s.webkitMaskImage,
          }
        : null;
    return {
      chapter: pick(cs(chapter)),
      rail: pick(cs(rail)),
      page: pick(cs(pageEl)),
    };
  });
  console.log(name, JSON.stringify(styles, null, 0).slice(0, 320));

  // Viewport only — fullPage + fixed mobile bar double-paints the tab bar mid-scroll
  await page.screenshot({
    path: path.join(OUT, name + '.png'),
    type: 'png',
    fullPage: false,
  });
  console.log('wrote', name);
}

await browser.close();
console.log(
  'done',
  fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length,
  'pngs'
);
