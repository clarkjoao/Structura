import { lazy, Suspense, memo, ComponentType } from "react";

// Dynamic import map for AWS icons — loads only when needed
const iconImportMap: Record<string, () => Promise<{ default: ComponentType<{ size?: number | string }> }>> = {};

// Build dynamic imports for all known icons
const iconModules = import.meta.glob(
  "/node_modules/aws-react-icons/lib/icons/*.js",
  { eager: false }
) as Record<string, () => Promise<{ default: ComponentType<{ size?: number | string }> }>>;

// Map icon names to their dynamic imports
Object.entries(iconModules).forEach(([path, loader]) => {
  const name = path.split("/").pop()?.replace(".js", "") ?? "";
  iconImportMap[name] = loader;
});

// Cache of lazy components
const lazyCache = new Map<string, React.LazyExoticComponent<ComponentType<{ size?: number | string }>>>();

const getLazyIcon = (iconName: string) => {
  if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

  const loader = iconImportMap[iconName];
  if (!loader) return null;

  const LazyComp = lazy(loader);
  lazyCache.set(iconName, LazyComp);
  return LazyComp;
};

interface AwsIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

const AwsIcon = memo(({ iconName, size = 24, className }: AwsIconProps) => {
  const LazyIcon = getLazyIcon(iconName);

  if (!LazyIcon) {
    // Fallback: show AWS logo placeholder
    return (
      <div
        className={`flex items-center justify-center ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.8} height={size * 0.8} fill="currentColor">
          <path d="M7.164 16.836a8 8 0 1 1 9.672 0L12 20l-4.836-3.164Z" opacity="0.3" />
          <text x="12" y="13" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">AWS</text>
        </svg>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className={`animate-pulse rounded bg-muted ${className ?? ""}`}
          style={{ width: size, height: size }}
        />
      }
    >
      <div className={className} style={{ width: size, height: size }}>
        <LazyIcon size={size} />
      </div>
    </Suspense>
  );
});

AwsIcon.displayName = "AwsIcon";

export default AwsIcon;
