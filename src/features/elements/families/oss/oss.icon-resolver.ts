import React, { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Box } from "lucide-react";
import type { IconResolver } from "@/features/cloud/model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

/** See `./ICONS_LICENSE.md` for Simple Icons CC0 + trademark caveats. */
const ossSvgModules = import.meta.glob<string>("./icons/*.svg", {
  query: "?url",
  import: "default",
  eager: false,
});

const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export const ossIconResolver: IconResolver = {
  resolve(iconName: string): LazyExoticComponent<IconComponent> | null {
    if (!iconName) return null;

    const modulePath = `./icons/${iconName}.svg`;
    const loader = ossSvgModules[modulePath];
    if (!loader) return null;

    if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

    const LazyComp = lazy(async () => {
      const svgUrl = await loader();
      const OssSvgIcon: IconComponent = ({ size = 24 }) =>
        React.createElement("img", {
          src: svgUrl,
          width: size,
          height: size,
          alt: "",
          style: { objectFit: "contain" },
        });
      return { default: OssSvgIcon };
    });

    lazyCache.set(iconName, LazyComp);
    return LazyComp;
  },

  Fallback: Box,
};
