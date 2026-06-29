import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'shareables', 'captures');
const reportPath = path.join(root, 'shareables', 'together-budget-tab-report.png');
const sample = JSON.parse(await fs.readFile(path.join(root, 'sample-budget-export.json'), 'utf8'));

const tabs = [
  { id: 'overview', label: 'Overview', note: 'Combined income, allocation health, and goal rollups' },
  { id: 'income', label: 'Income', note: 'Partner income cards with all sources in one place' },
  { id: 'expenses', label: 'Expenses', note: 'Needs, wants, savings, category totals, and split tracking' },
  { id: 'goals', label: 'Goals', note: 'Goal cards for planned spending and dreams' },
];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});

await context.addInitScript((budget) => {
  window.localStorage.setItem('together-budget-v1', JSON.stringify(budget));
}, sample);

const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images]
      .filter((img) => !img.complete)
      .map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })),
  );
});

for (const tab of tabs) {
  await page.click(`[data-view-target="${tab.id}"]`);
  await page.waitForSelector(`[data-view="${tab.id}"].is-active`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(450);

  const viewportPath = path.join(outDir, `${tab.id}-viewport.png`);
  await page.screenshot({ path: viewportPath, fullPage: false });

  const filePath = path.join(outDir, `${tab.id}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  tab.filePath = filePath;
  tab.reportPath = viewportPath;
}

await browser.close();

const reportWidth = 2400;
const margin = 96;
const gap = 56;
const titleHeight = 210;
const cardWidth = Math.floor((reportWidth - margin * 2 - gap) / 2);
const imageHeight = 830;
const cardHeight = 1040;
const reportHeight = titleHeight + margin + cardHeight * 2 + gap + margin;

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const svgText = (x, y, text, size, weight = 600, color = '#252525') => ({
  input: Buffer.from(`
    <svg width="${reportWidth}" height="${reportHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(text)}</text>
    </svg>
  `),
  top: 0,
  left: 0,
});

const composites = [
  {
    input: Buffer.from(`
      <svg width="${reportWidth}" height="${reportHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#fbf8ef"/>
        <rect x="0" y="0" width="100%" height="190" fill="#17212b"/>
      </svg>
    `),
    top: 0,
    left: 0,
  },
  svgText(margin, 88, 'Together Budget tab walkthrough', 58, 700, '#fffaf0'),
  svgText(margin, 144, 'Four share-ready snapshots of the completed budgeting app', 30, 500, '#f5d28b'),
];

for (const [index, tab] of tabs.entries()) {
  const row = Math.floor(index / 2);
  const col = index % 2;
  const left = margin + col * (cardWidth + gap);
  const top = titleHeight + row * (cardHeight + gap);

  composites.push({
    input: Buffer.from(`
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="${cardWidth - 16}" height="${cardHeight - 18}" rx="22" fill="#d8cfbf"/>
        <rect x="0" y="0" width="${cardWidth - 16}" height="${cardHeight - 18}" rx="22" fill="#fffdf7" stroke="#2b342e" stroke-width="4"/>
        <text x="36" y="64" fill="#182028" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">${escapeXml(tab.label)}</text>
        <text x="36" y="106" fill="#65625d" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="500">${escapeXml(tab.note)}</text>
      </svg>
    `),
    top,
    left,
  });

  const screenshot = await sharp(tab.reportPath)
    .resize({
      width: cardWidth - 72,
      height: imageHeight,
      fit: 'contain',
      background: '#fffdf7',
      withoutEnlargement: true,
    })
    .extend({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fffdf7',
    })
    .png()
    .toBuffer();

  const meta = await sharp(screenshot).metadata();
  composites.push({
    input: screenshot,
    top: top + 146,
    left: left + Math.floor((cardWidth - (meta.width ?? 0)) / 2) - 8,
  });
}

await sharp({
  create: {
    width: reportWidth,
    height: reportHeight,
    channels: 4,
    background: '#fbf8ef',
  },
})
  .composite(composites)
  .png()
  .toFile(reportPath);

console.log(`Saved ${tabs.length} screenshots to ${path.relative(root, outDir)}`);
console.log(`Saved report to ${path.relative(root, reportPath)}`);
