/**
 * Sync SVG payloads for GCP draw.io export.
 *
 * The canvas icon resolver loads the same files lazily as URLs; export needs
 * a data URI in the same tick, so this glob is eager + `?raw`. Bundle cost is
 * the ~40 catalog icons (~tens of KB), not the whole gcp-icons pack.
 */
const gcpSvgRawModules = import.meta.glob<string>("/node_modules/gcp-icons/dist/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

function toSvgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Draw.io image data URI for a GCP icon name, or `null` when the file is
 * missing from the pack (export then falls through to passthrough).
 */
export function gcpIconDataUri(iconName: string): string | null {
  if (!iconName) return null;
  const path = `/node_modules/gcp-icons/dist/icons/${iconName}.svg`;
  const raw = gcpSvgRawModules[path];
  if (typeof raw !== "string" || raw.length === 0) return null;
  return toSvgDataUri(raw);
}
