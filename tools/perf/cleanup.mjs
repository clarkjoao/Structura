import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:8199", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(() => {
  const keys = Object.keys(localStorage);
  localStorage.clear();
  return { removed: keys.length, keys };
});
console.log(JSON.stringify(r));
await browser.close();
