import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/PKPilot0012/';
const out = process.argv[3] ?? '/workspace/work/shots-vektra';
const exe = process.env.PW_CHROMIUM;

const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--enable-unsafe-swiftshader'] } : {});

async function ready(page) {
  await page.waitForSelector('[data-testid="engine-badge"][data-backend]:not([data-backend="loading"])', { timeout: 180000 });
}

async function detect(page) {
  for (let i = 0; i < 90; i += 1) {
    const text = await page.locator('[data-testid="detection-summary"]').innerText().catch(() => '');
    if (/탐지\s*[1-9]/.test(text)) return text;
    await page.waitForTimeout(1000);
  }
  return 'no detections';
}

// desktop, light
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto(base);
await ready(desktop);
await desktop.screenshot({ path: `${out}-landing.png` });
await desktop.getByTestId('sample-street').click();
console.log('desktop summary:', await detect(desktop));
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: `${out}-studio.png` });

// desktop, dark
await desktop.getByTestId('theme-fab').click();
await desktop.waitForTimeout(600);
await desktop.screenshot({ path: `${out}-dark.png` });
await desktop.getByTestId('theme-fab').click();

// mobile, light
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mobile.goto(base);
await ready(mobile);
await mobile.screenshot({ path: `${out}-mobile-landing.png` });
await mobile.getByTestId('sample-dog').click();
console.log('mobile summary:', await detect(mobile));
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${out}-mobile-studio.png` });
await mobile.screenshot({ path: `${out}-mobile-full.png`, fullPage: true });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('mobile overflow:', overflow);

await browser.close();
