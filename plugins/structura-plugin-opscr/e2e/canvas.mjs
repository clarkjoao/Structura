/**
 * Canvas gestures for the e2e scripts.
 */

/**
 * Zooms in around `node` (Ctrl+wheel, a pinch) until the canvas leaves its far level of detail,
 * which hides a card's secondary content — its drill-down button among it — as a reader would
 * before clicking it.
 */
export async function zoomUntilFull(page, node) {
  const canvas = page.locator(".react-flow").first();
  for (let step = 0; step < 30; step++) {
    if ((await canvas.getAttribute("data-lod")) !== "far") return;
    const box = await node.boundingBox();
    if (!box) throw new Error("the node to zoom in on is not drawn");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await page.waitForTimeout(150);
  }
  throw new Error("the canvas never left its far level of detail");
}
