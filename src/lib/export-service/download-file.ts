export interface ZipEntryFile {
  filename: string;
  content: string;
}

/**
 * Delay before revoking the object URL. Revoking synchronously after `click()`
 * races the browser's download start: Chrome then names the file after the blob
 * UUID and drops the extension (seen on GIF exports, which download late, after
 * an async recording).
 */
const REVOKE_DELAY_MS = 60_000;

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function downloadFile(content: string | Blob, filename: string, mime: string): void {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: mime })
      : content.type === mime
        ? content
        : new Blob([content], { type: mime });
  triggerDownload(blob, filename);
}

export async function downloadZip(files: ZipEntryFile[], zipFilename: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.content);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerDownload(zipBlob, zipFilename);
}
