import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const [, , url, outDir, label = 'ref'] = process.argv;
if (!url || !outDir) { console.error('usage: capture.mjs <url> <outDir> [label]'); process.exit(1); }
const widths = { mobile: 375, tablet: 768, desktop: 1440 };
await fs.mkdir(outDir, { recursive: true });
// Usa Chrome di sistema se il download dei browser di Playwright è bloccato (CHROME_PATH=/usr/bin/google-chrome).
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const result = {};

for (const [name, width] of Object.entries(widths)) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/${label}-${name}-fold.png` });
  await page.screenshot({ path: `${outDir}/${label}-${name}.png`, fullPage: true });
  result[name] = await page.evaluate(() => {
    const pick = (el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight,
        color: s.color, bg: s.backgroundColor, radius: s.borderRadius, padding: s.padding, margin: s.margin };
    };
    const styles = {};
    for (const q of ['body', 'h1', 'h2', 'h3', 'p', 'a', 'button', 'input', 'nav', 'header', 'footer']) {
      const el = document.querySelector(q);
      if (el) styles[q] = pick(el);
    }
    const boxes = [...document.querySelectorAll('header, nav, main, section, aside, footer, [role="dialog"]')]
      .slice(0, 40).map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), id: el.id || undefined, x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      });
    const counts = {};
    for (const el of [...document.querySelectorAll('body *')].slice(0, 3000)) {
      const s = getComputedStyle(el);
      for (const c of [s.color, s.backgroundColor]) if (c && c !== 'rgba(0, 0, 0, 0)') counts[c] = (counts[c] || 0) + 1;
    }
    const palette = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const headings = [...document.querySelectorAll('h1, h2, h3')].slice(0, 30).map((h) => h.tagName);
    const small = [...document.querySelectorAll('a, button, input, select, [role="button"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      return visible && (r.width < 44 || r.height < 44);
    }).map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).toString().trim().slice(0, 30));
    const overflowX = document.documentElement.scrollWidth > innerWidth;
    return { styles, boxes, palette, headings, smallTargets: small.length, smallTargetList: small.slice(0, 20), overflowX };
  });
  result[name].pageErrors = errors;
  await page.close();
}

await fs.writeFile(`${outDir}/${label}-tokens.json`, JSON.stringify(result, null, 2));
await browser.close();
console.log(`ok: ${outDir}/${label}-*.png + ${label}-tokens.json`);
