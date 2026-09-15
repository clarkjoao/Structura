/**
 * Sync SVG payloads for Kubernetes draw.io export (image floor).
 *
 * No `mxgraph.kubernetes.*` shapes are wired in this repo; export embeds the
 * same community SVGs the canvas loads. Missing files fall through to
 * passthrough in `k8s.family.ts`.
 */
const k8sSvgRawModules = import.meta.glob<string>("./icons/*.svg", {
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

/** Draw.io image data URI for a K8s icon stem, or `null` when missing. */
export function k8sIconDataUri(iconName: string): string | null {
  if (!iconName) return null;
  const path = `./icons/${iconName}.svg`;
  const raw = k8sSvgRawModules[path];
  if (typeof raw !== "string" || raw.length === 0) return null;
  return toSvgDataUri(raw);
}
