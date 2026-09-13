import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:8199", { waitUntil: "domcontentloaded", timeout: 60000 });
const out = await page.evaluate(() => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  const before = keys.slice();
  localStorage.clear();
  let after = 0;
  for (let i = 0; i < localStorage.length; i++) after++;
  return { removed: before.length, keys: before, remaining: after };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
