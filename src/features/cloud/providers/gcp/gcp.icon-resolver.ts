import React, { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Cloud } from "lucide-react";
import type { IconResolver } from "../../model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

// Vite resolves all GCP SVGs as URLs at build time (tree-shakeable per icon)
const gcpSvgModules = import.meta.glob<string>(
  "/node_modules/gcp-icons/dist/icons/*.svg",
  { query: "?url", import: "default", eager: false },
);

const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export const gcpIconResolver: IconResolver = {
  resolve(iconName: string): LazyExoticComponent<IconComponent> | null {
    if (!iconName) return null;

    const modulePath = `/node_modules/gcp-icons/dist/icons/${iconName}.svg`;
    const loader = gcpSvgModules[modulePath];
    if (!loader) return null;

    if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

    const LazyComp = lazy(async () => {
      const svgUrl = await loader();
      const GcpSvgIcon: IconComponent = ({ size = 24 }) =>
        React.createElement("img", {
          src: svgUrl,
          width: size,
          height: size,
          alt: "",
          style: { objectFit: "contain" },
        });
      return { default: GcpSvgIcon };
    });

    lazyCache.set(iconName, LazyComp);
    return LazyComp;
  },

  Fallback: Cloud,
};
