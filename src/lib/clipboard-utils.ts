export async function writeDrawioToClipboard(xml: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(xml);
  } catch {
    console.warn("[Clipboard] Could not write to system clipboard");
  }
}
