import React, { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Box } from "lucide-react";
import type { IconResolver } from "@/features/cloud/model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

/**
 * Vendored unlabeled SVGs from kubernetes/community (Apache-2.0 elected).
 * See `./ICONS_LICENSE.md`.
 */
const k8sSvgModules = import.meta.glob<string>("./icons/*.svg", {
  query: "?url",
  import: "default",
  eager: false,
});

const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export const k8sIconResolver: IconResolver = {
  resolve(iconName: string): LazyExoticComponent<IconComponent> | null {
    if (!iconName) return null;

    const modulePath = `./icons/${iconName}.svg`;
    const loader = k8sSvgModules[modulePath];
    if (!loader) return null;

    if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

    const LazyComp = lazy(async () => {
      const svgUrl = await loader();
      const K8sSvgIcon: IconComponent = ({ size = 24 }) =>
        React.createElement("img", {
          src: svgUrl,
          width: size,
          height: size,
          alt: "",
          style: { objectFit: "contain" },
        });
      return { default: K8sSvgIcon };
    });

    lazyCache.set(iconName, LazyComp);
    return LazyComp;
  },

  Fallback: Box,
};
