import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = process.env.NEST_FIXTURE_PORT || '18951';
const BASE = `http://127.0.0.1:${PORT}/nest/phase1b-world-fixture.html`;

const shots = [
  ['01-desktop-day', 'returning', 'continue', 'light', 1440, 980, false],
  ['02-desktop-night', 'returning', 'continue', 'dark', 1440, 980, false],
  ['03-mobile-day-390', 'returning', 'continue', 'light', 390, 844, true],
  ['04-mobile-night-390', 'returning', 'continue', 'dark', 390, 844, true],
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
  const url = `${BASE}?member=${member}&solo=${solo}&theme=${theme}&hide-banner=1&v=e1`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => {
    const b = document.getElementById('fixture-banner');
    if (b) b.style.display = 'none';
  });
  await new Promise((r) => setTimeout(r, 900));

  const styles = await page.evaluate(() => {
    const chapter = document.querySelector('.next-chapter');
    const img = document.querySelector('.nest-companions-day');
    const cs = chapter ? getComputedStyle(chapter) : null;
    return {
      mask: cs ? cs.webkitMaskImage || cs.maskImage : null,
      companionSrc: img?.getAttribute('src'),
      companionW: img?.clientWidth,
      companionH: img?.clientHeight,
    };
  });
  console.log(name, JSON.stringify(styles));

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
  fs.readdirSync(OUT).filter((f) => f.endsWith('.png')),
);
