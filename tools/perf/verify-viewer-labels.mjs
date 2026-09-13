// Opens the standalone viewer with a labelled diagram and counts the edge
// labels that reach the DOM. `/viewer#data=<lz>` is exactly what generateViewerUrl builds.
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import LZString from "/Users/clark/www/Structura/node_modules/lz-string/libs/lz-string.js";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199";
const payload = JSON.parse(readFileSync(join(FIX, "G.json"), "utf8"));
const diagram = payload.state.diagrams[payload.state.activeDiagramId];
const url = `${APP}/viewer#data=${LZString.compressToEncodedURIComponent(JSON.stringify(diagram))}`;
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 });
await page.waitForTimeout(6000); await page.bringToFront();
const r = await page.evaluate(() => ({
  nodes: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  labelRenderers: document.querySelectorAll(".react-flow__edgelabel-renderer").length,
  labelsInDom: [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && /^call \d+$/.test((el.textContent || "").trim())).length,
}));
console.log(JSON.stringify(r));
await browser.close();
