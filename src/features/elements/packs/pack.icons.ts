import React, { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Box } from "lucide-react";
import type { IconResolver } from "@/features/cloud/model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

/** An icon a pack can draw: a URL to load it from, and its markup for export when known. */
export interface PackIconSource {
  /** Resolves to a URL `<img>` can show (a bundled asset URL or a `data:` URI). */
  load: () => Promise<string>;
  /** The data URI draw.io export embeds; null when the icon is not available synchronously. */
  dataUri: () => string | null;
}

export function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * An `IconResolver` over a pack's icons, shown as `<img>` (pack SVGs are files, not React
 * components). Lazy like every family resolver, so the catalog does not fetch icons it never
 * shows; a failed load is not cached, so the next mount retries.
 */
export function packIconResolver(
  icons: ReadonlyMap<string, PackIconSource>,
  Fallback: IconComponent = Box,
): IconResolver {
  const cache = new Map<string, LazyExoticComponent<IconComponent>>();
  return {
    resolve(iconName) {
      const source = iconName ? icons.get(iconName) : undefined;
      if (!source) return null;
      const cached = cache.get(iconName);
      if (cached) return cached;
      const Lazy = lazy(() =>
        source.load().then(
          (src) => {
            const PackIcon: IconComponent = ({ size = 24 }) =>
              React.createElement("img", {
                src,
                width: size,
                height: size,
                alt: "",
                style: { objectFit: "contain" },
              });
            return { default: PackIcon };
          },
          (error: unknown) => {
            cache.delete(iconName);
            throw error;
          },
        ),
      );
      cache.set(iconName, Lazy);
      return Lazy;
    },
    Fallback,
  };
}

const builtinIconUrls = import.meta.glob<string>("./*/icons/*.svg", {
  query: "?url",
  import: "default",
  eager: false,
});
// Export embeds icons in the same tick, so their markup is bundled (the K8s and OSS families
// already did this for their own folders).
const builtinIconRaw = import.meta.glob<string>("./*/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The icons a built-in pack ships in `packs/<packId>/icons/`. */
export function builtinPackIcons(packId: string): Map<string, PackIconSource> {
  const prefix = `./${packId}/icons/`;
  const icons = new Map<string, PackIconSource>();
  for (const [file, load] of Object.entries(builtinIconUrls)) {
    if (!file.startsWith(prefix)) continue;
    const name = file.slice(prefix.length, -".svg".length);
    icons.set(name, {
      load,
      dataUri: () => {
        const raw = builtinIconRaw[file];
        return typeof raw === "string" && raw.length > 0 ? svgToDataUri(raw) : null;
      },
    });
  }
  return icons;
}

/** Icons given as SVG markup (plugins). The caller sanitizes them first. */
export function inlinePackIcons(
  svgByName: Readonly<Record<string, string>>,
): Map<string, PackIconSource> {
  const icons = new Map<string, PackIconSource>();
  for (const [name, svg] of Object.entries(svgByName)) {
    const dataUri = svgToDataUri(svg);
    icons.set(name, { load: () => Promise.resolve(dataUri), dataUri: () => dataUri });
  }
  return icons;
}
