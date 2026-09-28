// Clicks through the guided demo and saves a screenshot per beat.
//   npm run build && npm run screenshots
// Output: screenshots/NN-*.png (phone only) and screenshots/full/NN-*.png (whole window, levers on).
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist/index.html');
if (!existsSync(dist)) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}
const out = resolve(root, 'screenshots');
mkdirSync(resolve(out, 'full'), { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && !m.text().includes('ERR_FILE_NOT_FOUND') && errors.push(m.text()));

await page.goto(pathToFileURL(dist).href);
await page.waitForTimeout(1800);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

async function run(levers) {
  if (levers) await page.getByRole('button', { name: 'Show levers' }).click();
  await page.click('[data-ctl="start-demo"]');
  for (let i = 0; ; i++) {
    const title = await page.locator('[data-ctl="demo-title"]').textContent();
    const wait = /Back into the project/.test(title) ? 3600 : 1500;
    await page.waitForTimeout(wait);
    const name = `${String(i + 1).padStart(2, '0')}-${slug(title)}.png`;
    if (levers) await page.screenshot({ path: resolve(out, 'full', name) });
    else await page.locator('.phone-slot').screenshot({ path: resolve(out, name) });
    console.log(levers ? 'full/' + name : name);
    const label = await page.locator('[data-ctl="demo-next"]').textContent();
    await page.keyboard.press('ArrowRight');
    if (label?.includes('Finish')) break;
  }
  await page.waitForTimeout(400);
}

await run(false);
await run(true);
await browser.close();

if (errors.length) {
  console.error('\nPage errors:\n' + errors.join('\n'));
  process.exit(1);
}
