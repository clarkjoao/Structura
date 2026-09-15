/**
 * Sync SVG payloads for OSS draw.io export (image floor).
 *
 * No mxgraph pack for Redis/Kafka in this repo — embed the same SVGs the
 * canvas loads. Missing files fall through to passthrough.
 */
const ossSvgRawModules = import.meta.glob<string>("./icons/*.svg", {
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

export function ossIconDataUri(iconName: string): string | null {
  if (!iconName) return null;
  const path = `./icons/${iconName}.svg`;
  const raw = ossSvgRawModules[path];
  if (typeof raw !== "string" || raw.length === 0) return null;
  return toSvgDataUri(raw);
}
