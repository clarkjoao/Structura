import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Cloud } from "lucide-react";
import type { IconResolver } from "../../model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>();

export const azureIconResolver: IconResolver = {
  resolve(iconName: string): LazyExoticComponent<IconComponent> | null {
    if (!iconName) return null;

    if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

    const LazyComp = lazy(() =>
      load().catch((error: unknown) => {
        // A failed fetch (a redeploy, Vite's stale optimized deps) must not
        // stay cached: the next mount tries again.
        lazyCache.delete(iconName);
        throw error;
      }),
    );
    async function load() {
      const mod = await import("azure-react-icons");
      const Icon = (mod as Record<string, unknown>)[iconName] as IconComponent | undefined;
      const FallbackIcon: IconComponent = () => null as unknown as React.ReactElement;
      return { default: Icon ?? FallbackIcon };
    }

    lazyCache.set(iconName, LazyComp);
    return LazyComp;
  },

  Fallback: Cloud,
};
