import dynamicIconImports from "lucide-react/dynamicIconImports";
import { lazy, type ComponentType, type CSSProperties, type LazyExoticComponent } from "react";

type LucideIconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}>;

const lucideLazyCache = new Map<string, LazyExoticComponent<LucideIconComponent>>();

export function resolveLucideDynamicImportKey(
  iconName: string,
): keyof typeof dynamicIconImports | undefined {
  const trimmed = iconName.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (lower in dynamicIconImports) {
    return lower as keyof typeof dynamicIconImports;
  }

  const kebab = trimmed
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

  if (kebab in dynamicIconImports) {
    return kebab as keyof typeof dynamicIconImports;
  }

  return undefined;
}

export function getLazyLucideIcon(
  key: keyof typeof dynamicIconImports,
): LazyExoticComponent<LucideIconComponent> {
  const keyString = key as string;
  let cachedLazy = lucideLazyCache.get(keyString);
  if (!cachedLazy) {
    const importLoader = dynamicIconImports[key];
    cachedLazy = lazy(importLoader);
    lucideLazyCache.set(keyString, cachedLazy);
  }
  return cachedLazy;
}
