// End-to-end smoke test: drives the built app in a real browser against the
// local test server (tests/e2e/server.js must be running on port 4173).
//
//   node tests/e2e/smoke.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const SHOTS = process.env.SHOTS_DIR || '';
const fakeClerk = fs.readFileSync(path.join(__dirname, 'fake-clerk.js'), 'utf8');
const results = [];

async function step(name, fn) {
  if (process.env.DEBUG_NET) console.log('STEP', name);
  try {
    await fn();
    results.push(`ok    ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String(error.message).split('\n')[0]}`);
    throw error;
  }
}

(async () => {
  const browser = await chromium.launch();
  const userId = `user_e2e_${Date.now()}`;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(`window.__E2E_USER_ID = ${JSON.stringify(userId)};`);
  await context.addInitScript(fakeClerk);
  // Record Walmart links instead of opening real tabs.
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (url, name) => {
      window.__opened.push({ url, name });
      return { opener: null };
    };
  });
  const page = await context.newPage();
  const dialogs = [];
  const errors = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  page.on('pageerror', (e) => errors.push(e.message));
  if (process.env.DEBUG_NET) {
    page.on('console', (m) => { if (m.type() !== 'log') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
    page.on('requestfailed', (r) => console.log('REQFAIL', r.method(), r.url(), r.failure() && r.failure().errorText, (r.postData() || '').slice(0, 50)));
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log('HTTP', r.status(), r.request().method(), r.url()); });
  }
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
  };
  const text = () => page.locator('body').innerText();
  const tab = (label) => page.locator('.tab-navigation button', { hasText: label }).click();

  let replaced = '';
  try {
    await step('new user is asked to accept the Terms, then sent to profile setup', async () => {
      await page.goto(`${BASE}/auth-redirect`);
      await page.locator('input[type=checkbox]').first().check();
      await page.getByRole('button', { name: /accept/i }).click();
      await page.waitForURL('**/profile-setup');
    });

    await step('profile setup saves and lands on the dashboard', async () => {
      await page.getByText('Who are we cooking for?').waitFor();
      for (let i = 0; i < 11; i += 1) await page.locator('.next-btn').click();
      await page.locator('.next-btn', { hasText: 'Save & Start Meal Planning' }).click();
      await page.waitForURL('**/dashboard');
      await page.getByText('Weekly Meal Plan').waitFor();
    });

    await step('refreshing a deep link stays on that page (no 404, no bounce to setup)', async () => {
      await page.goto(`${BASE}/dashboard?tab=pantry`);
      await page.getByText('Pantry Management').waitFor();
      assert.match(page.url(), /dashboard\?tab=pantry/);
    });

    await step('pantry: add an item by hand and scan a photo', async () => {
      await page.getByRole('button', { name: /Add Manually/ }).click();
      await page.getByPlaceholder('Item name').fill('Long grain rice');
      await page.locator('.add-form select').selectOption('Grains');
      await page.getByPlaceholder('Quantity (optional)').fill('2 lb');
      await page.getByRole('button', { name: 'Add Item' }).click();
      await page.getByText('Current Pantry (1 items)').waitFor();

      // A large "photo": it must be shrunk in the browser before upload.
      const big = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 4000;
        canvas.height = 3000;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 400000; i += 1) {
          ctx.fillStyle = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;
          ctx.fillRect(Math.random() * 4000, Math.random() * 3000, 8, 8);
        }
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        return { size: blob.size, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
      });
      let uploaded = 0;
      page.on('request', (request) => {
        if (request.url().endsWith('/api/ai') && (request.postData() || '').includes('pantryScan')) uploaded = request.postData().length;
      });
      await page.locator('input[type=file]').setInputFiles({ name: 'fridge.png', mimeType: 'image/png', buffer: Buffer.from(big.bytes) });
      await page.getByText('Current Pantry (3 items)').waitFor();
      assert.ok(big.size > 4_500_000 && uploaded > 0 && uploaded < 2_500_000, `upload was ${uploaded} bytes for a ${big.size} byte photo`);
      results.push(`      photo: ${(big.size / 1e6).toFixed(1)} MB original -> ${(uploaded / 1e6).toFixed(2)} MB uploaded`);
      await shot('pantry');
    });

    await step('meal plan: generates seven days and shows the budget summary', async () => {
      await tab('Meal Plan');
      await page.getByRole('button', { name: 'Generate Meal Plan' }).click();
      await page.getByText('Estimated cost of meals: $99.75').waitFor();
      for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
        assert.ok((await text()).includes(day), `${day} is shown`);
      }
      const sent = await (await fetch(`${BASE}/__test`)).json();
      const prompt = sent.lastCall.messages[0].content;
      assert.match(prompt, /Long grain rice \(2 lb\)/, 'the pantry reached the planner');
      assert.match(prompt, /Whole Milk/, 'scanned items reached the planner');
      await shot('meal-plan');
    });

    await step('meal plan: replacing a meal works and survives a reload', async () => {
      await page.locator('.replace-btn').first().click();
      await page.getByText(/Garlic butter shrimp pasta #\d+/).first().waitFor();
      replaced = (await text()).match(/Garlic butter shrimp pasta #\d+/)[0];
      await page.reload();
      await page.getByText(replaced).waitFor();
    });

    await step('a temporary AI failure is retried automatically', async () => {
      await fetch(`${BASE}/__test/fail-ai?n=1`);
      await page.locator('.replace-btn').nth(1).click();
      await page.waitForFunction(() => (document.body.innerText.match(/Garlic butter shrimp pasta #\d+/g) || []).length === 2);
      assert.ok(!dialogs.some((d) => /busy|failed/i.test(d)), 'no error shown to the user');
    });

    await step('a lasting AI failure gives a clear message and the plan is untouched', async () => {
      await fetch(`${BASE}/__test/fail-ai?n=2`);
      await page.locator('.replace-btn').nth(2).click();
      await page.waitForFunction(() => !document.body.innerText.includes('Replacing...'));
      assert.ok(dialogs.some((d) => /busy right now/i.test(d)), `saw: ${dialogs.slice(-1)}`);
      assert.equal(((await text()).match(/Garlic butter shrimp pasta #\d+/g) || []).length, 2);
    });

    await step('accepting the plan builds the shopping list and all recipes', async () => {
      dialogs.length = 0;
      await page.locator('.accept-btn').first().click();
      for (let i = 0; i < 300 && !dialogs.length; i += 1) await page.waitForTimeout(200);
      assert.ok(dialogs.some((d) => /Shopping list and all recipes are ready/.test(d)), `saw: ${dialogs.join(' | ')}`);
      assert.equal(await page.locator('.accept-btn').count(), 0);
    });

    await step('shopping list: totals are right and Shop Mode walks every item', async () => {
      await tab('Shopping List');
      await page.getByText('Estimated total: $35.77').waitFor();
      await shot('shopping-list');
      await page.getByRole('button', { name: 'Start shopping' }).click();
      await page.getByText('Item 1 of 5').waitFor();
      await shot('shop-mode');
      for (let i = 0; i < 5; i += 1) {
        await page.getByRole('button', { name: 'Find at Walmart' }).click();
        await page.getByRole('button', { name: /Added to cart/ }).click();
      }
      await page.getByText("That's everything!").waitFor();
      const opened = await page.evaluate(() => window.__opened);
      assert.equal(opened.length, 5);
      assert.equal(opened[0].url, 'https://www.walmart.com/search?q=bananas');
      assert.equal(opened[3].url, 'https://www.walmart.com/search?q=great%20value%202%25%20milk%20gallon');
      assert.ok(opened.every((o) => o.name === opened[0].name), 'one Walmart tab is reused');
    });

    await step('shopping progress is saved to the account', async () => {
      await page.reload();
      await page.getByText('5 of 5 items done').waitFor();
      assert.equal(await page.locator('.shopping-item.checked').count(), 5);
    });

    await step('recipes: opening a recipe uses the saved copy (no new AI call)', async () => {
      const before = (await (await fetch(`${BASE}/__test`)).json()).calls;
      await tab('Recipes');
      await page.locator('.recipe-card h3').first().click();
      await page.getByText('Heat the oven to 425°F.').waitFor();
      const after = (await (await fetch(`${BASE}/__test`)).json()).calls;
      assert.equal(after, before, 'recipe came from the cache');
      await shot('recipe');
    });

    await step('quick meal from the pantry', async () => {
      await page.goto(`${BASE}/dashboard?tab=quick-meal`);
      await page.getByText('You have 3 items in your pantry').waitFor();
      await page.locator('.quick-meal-container button').first().click();
      await page.getByText('Cheesy rice and egg skillet').waitFor();
    });

    let shareUrl = '';
    await step('sharing creates a short link', async () => {
      await page.goto(`${BASE}/dashboard?tab=meal-plan`);
      await page.getByRole('button', { name: /Share Plan/ }).click();
      await page.getByText('Share Your Meal Plan').waitFor();
      shareUrl = await page.locator('input[readonly]').inputValue();
      assert.match(shareUrl, /\/shared\/[A-Za-z0-9_-]{12}$/);
    });

    await step('the shared link opens for someone who is not signed in', async () => {
      const guest = await browser.newContext();
      await guest.addInitScript('window.__E2E_SIGNED_OUT = true;');
      await guest.addInitScript(fakeClerk);
      const guestPage = await guest.newPage();
      await guestPage.goto(shareUrl);
      await guestPage.getByText('Shared by: Sam').waitFor();
      await guestPage.getByText(replaced).waitFor();
      // Signed-out visitors are sent to sign in, not shown someone's dashboard.
      await guestPage.goto(`${BASE}/dashboard`);
      await guestPage.waitForURL('**/sign-in');
      await guest.close();
    });

    await step('a failed save is shown, kept, and synced once the connection returns', async () => {
      await page.goto(`${BASE}/dashboard?tab=pantry`);
      await page.getByText('Current Pantry (3 items)').waitFor();
      await page.route('**/api/kv?key=pantry', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
      await page.getByRole('button', { name: /Add Manually/ }).click();
      await page.getByPlaceholder('Item name').fill('Olive oil');
      await page.locator('.add-form select').selectOption('Condiments');
      await page.getByRole('button', { name: 'Add Item' }).click();
      await page.locator('.sync-status').waitFor({ timeout: 15000 });
      await shot('sync-warning');
      await page.unroute('**/api/kv?key=pantry');
      await page.getByRole('button', { name: 'Retry now' }).click();
      await page.locator('.sync-status').waitFor({ state: 'detached', timeout: 15000 });
      await page.reload();
      await page.getByText('Current Pantry (4 items)').waitFor();
      await page.getByText('Olive oil').waitFor();
    });

    await step('a save interrupted by closing the tab is finished on the next visit', async () => {
      await page.route('**/api/kv?key=pantry', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
      await page.getByRole('button', { name: /Add Manually/ }).click();
      await page.getByPlaceholder('Item name').fill('Butter');
      await page.locator('.add-form select').selectOption('Dairy');
      await page.getByRole('button', { name: 'Add Item' }).click();
      await page.locator('.sync-status').waitFor({ timeout: 15000 });
      await page.unroute('**/api/kv?key=pantry');
      // Leave without retrying, then come back: nothing is lost.
      await page.goto('about:blank');
      await page.goto(`${BASE}/dashboard?tab=pantry`);
      await page.getByText('Current Pantry (5 items)').waitFor();
      await page.waitForFunction(() => !document.querySelector('.sync-status'));
      const token = `test-token:${userId}`;
      const stored = await (await fetch(`${BASE}/api/kv?key=pantry`, { headers: { Authorization: `Bearer ${token}` } })).json();
      assert.equal(stored.length, 5, 'the server has the item too');
    });

    await step('no JavaScript errors were thrown on any page', async () => {
      assert.deepEqual(errors, []);
    });
  } catch (error) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'failure.png'), fullPage: true }).catch(() => {});
    results.push(`      page said: ${(await text().catch(() => '')).slice(0, 400).replace(/\n+/g, ' | ')}`);
    if (errors.length) results.push(`      page errors: ${errors.join(' || ').slice(0, 400)}`);
    if (dialogs.length) results.push(`      dialogs: ${dialogs.slice(-3).join(' || ').slice(0, 400)}`);
    process.exitCode = 1;
  } finally {
    console.log(results.join('\n'));
    await browser.close();
  }
})();
