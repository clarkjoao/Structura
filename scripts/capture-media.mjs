// Regenerates the README screenshots and demo recording under docs/assets/.
//
// Usage:
//   npm run dev                          # in another terminal (port 8080)
//   npm run media:capture                # writes docs/assets/screenshots/*.png + docs/assets/demo.*
//
// Environment:
//   STRUCTURA_URL       app origin (default http://localhost:8080)
//   PLAYWRIGHT_CHANNEL  e.g. "chrome" to drive an installed Chrome instead of
//                       Playwright's bundled Chromium (`npx playwright install chromium`)
//   SKIP_VIDEO=1        screenshots only
//
// The screenshots use the demo workspace the app seeds on a fresh profile
// (src/fixtures/seeds — its content is intentionally Portuguese); the recording
// builds a small diagram from scratch. The recording is converted with ffmpeg
// when it is on the PATH; otherwise the raw .webm from Playwright is kept.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "docs", "assets");
const SHOTS = join(ASSETS, "screenshots");
const BASE = (process.env.STRUCTURA_URL ?? "http://localhost:8080").replace(/\/$/, "");
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || undefined;

// Seed diagram ids (src/fixtures/seeds/pixledger/ids.ts).
const D_CONTEXT = "d-pl-context";
const D_AWS = "d-pl-dp-hub";

const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: CHANNEL });

async function newContext({ theme = "light", video } = {}) {
  const context = await browser.newContext({
    viewport: video ? video.size : VIEWPORT,
    deviceScaleFactor: video ? 1 : 2,
    locale: "en-US",
    recordVideo: video,
  });
  await context.addInitScript((t) => {
    localStorage.setItem("structura_language", "en");
    localStorage.setItem("structura_theme", t);
  }, theme);
  return context;
}

async function settle(page, ms = 1500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function openDiagram(page, id) {
  await page.goto(`${BASE}/model/${id}`);
  await page.locator(".react-flow__node").first().waitFor();
  await settle(page);
  const collapse = page.getByRole("button", { name: "Minimize toolbar" });
  if (await collapse.count()) await collapse.first().click();
  await page.locator(".react-flow__controls-fitview").click();
  await settle(page, 800);
}

async function screenshots() {
  const context = await newContext();
  const page = await context.newPage();

  // Boot once so the seed workspace is written before any diagram route opens.
  await page.goto(`${BASE}/workspace`);
  await settle(page, 2500);
  await page.getByText("PixLedger", { exact: true }).first().click();
  await settle(page);
  await page.screenshot({ path: join(SHOTS, "workspace.png") });

  await openDiagram(page, D_CONTEXT);
  await page.screenshot({ path: join(SHOTS, "canvas-c4.png") });

  await openDiagram(page, D_AWS);
  await page.screenshot({ path: join(SHOTS, "canvas-aws.png") });

  await page.goto(`${BASE}/plugins`);
  await settle(page);
  for (const example of ["mermaid-import", "console-log"]) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Install plugin" }).first().click();
    await (await chooser).setFiles(join(ROOT, "plugins", "examples", example, "plugin.js"));
    await page.getByRole("button", { name: "Install", exact: true }).click();
    await settle(page, 800);
  }
  await page.screenshot({ path: join(SHOTS, "plugins.png") });
  await context.close();

  const dark = await newContext({ theme: "dark" });
  const darkPage = await dark.newPage();
  await darkPage.goto(`${BASE}/workspace`);
  await settle(darkPage, 2500);
  await openDiagram(darkPage, D_AWS);
  await darkPage.screenshot({ path: join(SHOTS, "dark-mode.png") });
  await dark.close();
}

async function recording() {
  const videoDir = mkdtempSync(join(tmpdir(), "structura-demo-"));
  const size = { width: 1280, height: 800 };
  const context = await newContext({ video: { dir: videoDir, size } });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto(`${BASE}/workspace`);
  await settle(page, 2000);

  // 1. Create a diagram.
  await page.getByRole("button", { name: "New diagram" }).first().click();
  await pause(400);
  await page
    .getByPlaceholder("e.g. System Context")
    .pressSequentially("Online Store", { delay: 60 });
  await pause(300);
  await page.getByRole("button", { name: "Create diagram" }).click();
  await page.locator(".react-flow__pane").waitFor();
  await pause(1200);

  // 2. Add three elements with the keyboard shortcuts and place them.
  const pane = page.locator(".react-flow__pane");
  async function addElement(shortcut, name, x) {
    await page.keyboard.press(shortcut);
    await pause(500);
    const nameInput = page.getByLabel("Name");
    await nameInput.fill("");
    await nameInput.pressSequentially(name, { delay: 45 });
    const position = page.locator("input[type=number]");
    await position.nth(0).fill(String(x));
    await position.nth(0).press("Enter");
    await position.nth(1).fill("0");
    await position.nth(1).press("Enter");
    await pause(300);
    await pane.click({ position: { x: 200, y: size.height - 120 } });
    await page.locator(".react-flow__controls-fitview").click();
    await pause(700);
  }
  await addElement("ControlOrMeta+1", "Customer", 0);
  await addElement("ControlOrMeta+2", "Online Store", 420);
  await addElement("ControlOrMeta+2", "Payment Provider", 840);

  // 3. Connect them: drag from a right (output) handle to a left (input) handle.
  async function handleCenter(nodeName, side) {
    const box = await page
      .locator(".react-flow__node", { hasText: nodeName })
      .locator(`.react-flow__handle-${side}`)
      .first()
      .boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  async function connect(from, to) {
    const source = await handleCenter(from, "right");
    const target = await handleCenter(to, "left");
    await page.mouse.move(source.x, source.y, { steps: 8 });
    await page.mouse.down();
    await page.mouse.move((source.x + target.x) / 2, source.y + 30, { steps: 15 });
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.mouse.up();
    await pause(700);
  }
  await connect("Customer", "Online Store");
  await connect("Online Store", "Payment Provider");
  await pane.click({ position: { x: 200, y: size.height - 120 } });
  await pause(800);

  // 4. Export.
  await page.getByRole("button", { name: "More options" }).click();
  await pause(500);
  await page.getByRole("menuitem", { name: "Export" }).click();
  await pause(2500);

  await context.close();
  const raw = join(
    videoDir,
    readdirSync(videoDir).find((f) => f.endsWith(".webm")),
  );
  const webm = join(ASSETS, "demo.webm");
  const gif = join(ASSETS, "demo.gif");

  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    copyFileSync(raw, webm);
    console.warn("ffmpeg not found: kept the raw recording at", webm);
    rmSync(videoDir, { recursive: true, force: true });
    return;
  }

  // Skip the first half second (blank page while the app boots).
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-i",
    raw,
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "40",
    "-an",
    webm,
  ]);
  const palette = join(videoDir, "palette.png");
  const filters = "fps=12,scale=960:-1:flags=lanczos";
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-i",
    raw,
    "-vf",
    `${filters},palettegen=stats_mode=diff`,
    palette,
  ]);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-i",
    raw,
    "-i",
    palette,
    "-lavfi",
    `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
    gif,
  ]);
  rmSync(videoDir, { recursive: true, force: true });

  for (const file of [webm, gif]) {
    console.log(
      `${file.replace(ROOT + "/", "")}: ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`,
    );
  }
}

try {
  await screenshots();
  console.log("screenshots written to", SHOTS.replace(ROOT + "/", ""));
  if (!process.env.SKIP_VIDEO) await recording();
} finally {
  await browser.close();
}
