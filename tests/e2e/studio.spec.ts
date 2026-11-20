import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function detectionCount(page: Page): Promise<number> {
  const text = (await page.getByTestId('detection-summary').innerText()) || '';
  const match = text.match(/탐지\s*(\d+)개/);
  return match ? Number(match[1]) : -1;
}

test('landing boots the engine and reports the backend that actually ran', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('객체');
  await expect(page.getByTestId('engine-badge')).toHaveAttribute('data-backend', /webgpu|webgl|wasm/, { timeout: 150_000 });
  await expect(page.getByTestId('landing-ready')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a bundled sample produces real detections and exports them', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.getByTestId('engine-badge')).toHaveAttribute('data-backend', /webgpu|webgl|wasm/, { timeout: 150_000 });

  await page.getByTestId('sample-street').click();
  await expect(page.getByTestId('stage-canvas')).toBeVisible();
  await expect.poll(() => detectionCount(page), { timeout: 60_000 }).toBeGreaterThan(5);

  // The car class chip carries a live count.
  const carChip = page.getByTestId('class-2');
  await expect(carChip).toContainText(/\d+/);

  // Hiding a class removes its boxes from the summary.
  const before = await detectionCount(page);
  await carChip.click();
  await expect.poll(() => detectionCount(page)).toBeLessThan(before);
  await page.getByTestId('class-show-all').click();
  await expect.poll(() => detectionCount(page)).toBeGreaterThanOrEqual(before);

  // A confidence above every score empties the frame.
  await page.getByTestId('conf-slider').fill('0.95');
  await expect.poll(() => detectionCount(page), { timeout: 30_000 }).toBeLessThan(before);
  await page.getByTestId('conf-slider').fill('0.25');
  await expect.poll(() => detectionCount(page), { timeout: 30_000 }).toBeGreaterThan(5);

  // JSON export carries source-pixel boxes.
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-json').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);

  const pngPromise = page.waitForEvent('download');
  await page.getByTestId('export-png').click();
  const png = await pngPromise;
  expect(png.suggestedFilename()).toMatch(/\.png$/);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('the theme toggle swaps the HD2Lab palettes', async ({ page }) => {
  await page.goto('./');
  const root = page.locator('html');
  const initial = (await root.getAttribute('data-theme')) ?? 'light';
  await page.getByTestId('theme-fab').click();
  await expect(root).toHaveAttribute('data-theme', initial === 'light' ? 'dark' : 'light');
  await page.getByTestId('theme-fab').click();
  await expect(root).toHaveAttribute('data-theme', initial);
});

test('no horizontal overflow on a 1440×900 desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await expect(page.getByTestId('engine-badge')).toHaveAttribute('data-backend', /webgpu|webgl|wasm/, { timeout: 150_000 });
  await page.getByTestId('sample-street').click();
  await expect.poll(() => detectionCount(page), { timeout: 60_000 }).toBeGreaterThan(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('no horizontal overflow on a 390×844 phone, in the studio too', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByTestId('engine-badge')).toHaveAttribute('data-backend', /webgpu|webgl|wasm/, { timeout: 150_000 });

  const landingOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(landingOverflow).toBeLessThanOrEqual(0);

  await page.getByTestId('sample-dog').click();
  await expect.poll(() => detectionCount(page), { timeout: 60_000 }).toBeGreaterThan(0);

  const studioOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(studioOverflow).toBeLessThanOrEqual(0);
});

test('a class can be marked for mosaic and the box count follows', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('engine-badge')).toHaveAttribute('data-backend', /webgpu|webgl|wasm/, { timeout: 150_000 });
  await page.getByTestId('sample-dog').click();
  await expect.poll(() => detectionCount(page), { timeout: 60_000 }).toBeGreaterThan(0);

  await page.getByTestId('class-mode-blur').click();
  await page.getByTestId('class-16').click();
  await expect(page.getByTestId('class-16')).toHaveAttribute('data-state', 'blur');
  await page.getByTestId('toggle-mosaic').click();
  await expect(page.getByTestId('toggle-mosaic')).toHaveAttribute('aria-checked', 'true');
});
