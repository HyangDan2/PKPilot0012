import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'https://hyangdan2.github.io/PKPilot0012/';
const exe = process.env.PW_CHROMIUM;

const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--enable-unsafe-swiftshader'] } : {});
const errors = [];

async function boot(page) {
  await page.waitForSelector('[data-testid="engine-badge"][data-backend]:not([data-backend="loading"])', { timeout: 240000 });
}

async function detect(page) {
  for (let i = 0; i < 120; i += 1) {
    const text = await page.locator('[data-testid="detection-summary"]').innerText().catch(() => '');
    if (/탐지\s*[1-9]/.test(text)) return text;
    await page.waitForTimeout(1000);
  }
  return 'NO DETECTIONS';
}

// ── PC (light) ──────────────────────────────────────────────────────────────
const pc = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
pc.on('console', (m) => { if (m.type() === 'error') errors.push(`pc console: ${m.text()}`); });
pc.on('pageerror', (e) => errors.push(`pc pageerror: ${e.message}`));
await pc.goto(base, { waitUntil: 'load' });
await boot(pc);
await pc.getByTestId('sample-street').click();
console.log('pc summary:', await detect(pc));
await pc.waitForTimeout(1200);
await pc.screenshot({ path: '/workspace/work/vektra-var-pc.png' });
const pcOverflow = await pc.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('pc overflow:', pcOverflow);

// ── PC (dark) ───────────────────────────────────────────────────────────────
await pc.getByTestId('theme-fab').click();
await pc.waitForTimeout(900);
await pc.screenshot({ path: '/workspace/work/vektra-var-dark.png' });
console.log('theme now:', await pc.getAttribute('html', 'data-theme'));
await pc.getByTestId('theme-fab').click();
await pc.waitForTimeout(400);
console.log('theme back:', await pc.getAttribute('html', 'data-theme'));

// ── mobile ──────────────────────────────────────────────────────────────────
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
mobile.on('console', (m) => { if (m.type() === 'error') errors.push(`mobile console: ${m.text()}`); });
mobile.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
await mobile.goto(base, { waitUntil: 'load' });
await boot(mobile);
await mobile.getByTestId('sample-street').click();
console.log('mobile summary:', await detect(mobile));
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: '/workspace/work/vektra-var-mobile.png' });
const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('mobile overflow:', mobileOverflow);

// ── asset + meta checks ─────────────────────────────────────────────────────
const assets = [
  'models/yolo11n.onnx',
  'ort/ort-wasm-simd-threaded.jsep.wasm',
  'og-image.png',
  'manifest.json',
  'favicon.ico',
  'favicon.svg',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'samples/sample-street.jpg',
];
for (const asset of assets) {
  const response = await pc.request.get(new URL(asset, base).href);
  console.log(`asset ${asset}: ${response.status()} ${response.headers()['content-type']}`);
}

const meta = await pc.evaluate(() => ({
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
  twitter: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'),
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  title: document.title,
}));
console.log('meta:', meta);
console.log('errors:', errors);

await browser.close();
