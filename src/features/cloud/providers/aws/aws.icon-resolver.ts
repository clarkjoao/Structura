import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Network } from "lucide-react";
import type { IconResolver } from "../../model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export const awsIconResolver: IconResolver = {
  resolve(iconName: string): LazyExoticComponent<IconComponent> | null {
    if (!iconName) return null;

    if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

    const LazyComp = lazy(async () => {
      const mod = await import("aws-react-icons");
      const Icon = (mod as Record<string, unknown>)[iconName] as IconComponent | undefined;
      const FallbackIcon: IconComponent = () => null as unknown as React.ReactElement;
      return { default: Icon ?? FallbackIcon };
    });

    lazyCache.set(iconName, LazyComp);
    return LazyComp;
  },

  Fallback: Network,
};
