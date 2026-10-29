import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const origin = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const legacy = {
  'bns.model-settings.v1': { raceScale: { lyn: 0.82 } },
  'bns.render-settings.v1': { pixelRatio: 1, shadows: false, antialias: false },
  'nams-testlab-game-settings-v1': { runSpeed: 7.8, startWeapon: 'ak47', startZone: 'range' },
  'nams-battle-royal-animation-settings-v1': { 'jump|none': 'rifle-jump.fbx' },
  'bns.audio.v1': { muted: true, music: 0.2, effects: 0.6 },
};
async function seed(page) {
  await page.addInitScript((settings) => {
    if (sessionStorage.getItem('configuration-test-seeded')) return;
    for (const [key, value] of Object.entries(settings)) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('bns.slots.v1', '[]');
    sessionStorage.setItem('configuration-test-seeded', 'true');
  }, legacy);
}
async function readDatabase(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('nams-battle-royal', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const connection = request.result;
      const transaction = connection.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const keys = store.getAllKeys();
      const values = store.getAll();
      transaction.oncomplete = () => {
        connection.close();
        resolve(Object.fromEntries(keys.result.map((key, index) => [key, values.result[index]])));
      };
      transaction.onabort = () => { connection.close(); reject(transaction.error); };
    };
  }));
}
async function failWrites(page, key) {
  await page.evaluate((failedKey) => {
    globalThis.originalConfigurationPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      const request = globalThis.originalConfigurationPut.call(this, value, key);
      if (key === failedKey) this.transaction.abort();
      return request;
    };
  }, key);
}
async function restoreWrites(page) {
  await page.evaluate(() => { IDBObjectStore.prototype.put = globalThis.originalConfigurationPut; });
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  await page.goto(`${origin}/settings`);
  await page.getByRole('heading', { name: 'Cấu hình ứng dụng' }).waitFor();
  assert.equal(await page.getByLabel('Tỉ lệ cơ thể · Lyn', { exact: true }).inputValue(), '0.82');
  assert.deepEqual(await readDatabase(page), legacy);
  assert.deepEqual(await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), Object.keys(legacy)),
    Object.keys(legacy).map(() => null));
  assert.equal(await page.evaluate(() => localStorage.getItem('bns.slots.v1')), '[]');
  console.log('PASS: five configuration groups migrated before rendering; character saves preserved');

  await page.getByLabel('Tỉ lệ cơ thể · Lyn', { exact: true }).fill('0.9');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu' }).waitFor();
  assert.equal((await readDatabase(page))['bns.model-settings.v1'].raceScale.lyn, 0.9);
  await page.reload();
  assert.equal(await page.getByLabel('Tỉ lệ cơ thể · Lyn', { exact: true }).inputValue(), '0.9');

  await failWrites(page, 'bns.model-settings.v1');
  await page.getByLabel('Tỉ lệ cơ thể · Lyn', { exact: true }).fill('1.1');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Không lưu được' }).waitFor();
  assert.equal((await readDatabase(page))['bns.model-settings.v1'].raceScale.lyn, 0.9);
  assert.equal(await page.getByRole('status').filter({ hasText: 'Đã lưu' }).count(), 0);
  await restoreWrites(page);
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu' }).waitFor();
  console.log('PASS: committed writes survive reload; aborted writes report errors and can be retried');

  await page.evaluate(async () => {
    const { writeConfiguration, readConfiguration } = await import('/src/settings/configurationStore.ts');
    const key = 'nams-testlab-game-settings-v1';
    const next = { runSpeed: 9 };
    const first = writeConfiguration(key, { runSpeed: 8 });
    const second = writeConfiguration(key, next);
    next.runSpeed = 200;
    await Promise.all([first, second]);
    if (readConfiguration(key).runSpeed !== 9) throw new Error('Write order or snapshot changed');
  });
  assert.equal((await readDatabase(page))['nams-testlab-game-settings-v1'].runSpeed, 9);
  await page.evaluate(() => localStorage.setItem('bns.render-settings.v1', JSON.stringify({ shadows: true })));
  await page.reload();
  await page.getByRole('heading', { name: 'Cấu hình ứng dụng' }).waitFor();
  assert.equal((await readDatabase(page))['bns.render-settings.v1'].shadows, false);
  assert.equal(await page.evaluate(() => localStorage.getItem('bns.render-settings.v1')), null);
  console.log('PASS: queued saves preserve the latest snapshot; IndexedDB takes precedence over stale legacy values');

  await page.locator('nav a[href="#audio"]').click();
  await failWrites(page, 'bns.audio.v1');
  await page.getByLabel('Bật âm thanh ứng dụng').check();
  await page.getByRole('alert').filter({ hasText: 'Không lưu được âm thanh' }).waitFor();
  assert.equal((await readDatabase(page))['bns.audio.v1'].muted, true);
  await restoreWrites(page);
  await page.getByLabel('Bật âm thanh ứng dụng').uncheck();
  await page.getByRole('status').filter({ hasText: 'Đang lưu âm thanh' }).waitFor({ state: 'hidden' });
  assert.equal((await readDatabase(page))['bns.audio.v1'].muted, true);
  assert.deepEqual(errors, []);
  console.log('PASS: audio persistence failures are visible and do not produce unhandled errors');

  const interrupted = await browser.newContext();
  const recovery = await interrupted.newPage();
  await seed(recovery);
  await recovery.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    globalThis.originalConfigurationPut = original;
    IDBObjectStore.prototype.put = function(value, key) {
      const request = original.call(this, value, key);
      this.transaction.abort();
      return request;
    };
  });
  await recovery.goto(`${origin}/settings`);
  await recovery.getByRole('alert').filter({ hasText: 'Không mở được cấu hình' }).waitFor();
  assert.deepEqual(await readDatabase(recovery), {});
  assert.equal(await recovery.evaluate(() => JSON.parse(localStorage.getItem('bns.audio.v1')).muted), true);
  await restoreWrites(recovery);
  await recovery.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await recovery.getByRole('heading', { name: 'Cấu hình ứng dụng' }).waitFor();
  assert.deepEqual(await readDatabase(recovery), legacy);
  console.log('PASS: aborted migration preserves localStorage and retries without partial data');
} finally { await browser.close(); }
