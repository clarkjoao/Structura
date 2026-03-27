import JSZip from "jszip";

export interface ZipEntryFile {
  filename: string;
  content: string;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFile(
  content: string,
  filename: string,
  mime: string,
): void {
  triggerDownload(new Blob([content], { type: mime }), filename);
}

export async function downloadZip(
  files: ZipEntryFile[],
  zipFilename: string,
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.content);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerDownload(zipBlob, zipFilename);
}
