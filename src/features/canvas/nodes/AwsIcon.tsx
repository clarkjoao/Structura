import { memo, type ComponentType, Suspense, lazy } from "react";

type IconComponent = ComponentType<{ size?: number | string }>;

const lazyCache = new Map<string, React.LazyExoticComponent<IconComponent>>();

const getLazyIcon = (iconName: string) => {
  if (lazyCache.has(iconName)) return lazyCache.get(iconName)!;

  const LazyComp = lazy(async () => {
    const mod = await import("aws-react-icons");
    const Icon = (mod as Record<string, unknown>)[iconName] as IconComponent | undefined;
    const FallbackIcon: IconComponent = () => null;
    return { default: Icon || FallbackIcon };
  });

  lazyCache.set(iconName, LazyComp);
  return LazyComp;
};

interface AwsIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

const Fallback = ({ size, className }: { size: number; className?: string }) => (
  <div
    className={`animate-pulse rounded bg-muted ${className ?? ""}`}
    style={{ width: size, height: size }}
  />
);

const NotFound = ({ size, className }: { size: number; className?: string }) => (
  <div
    className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 24 24" width={size * 0.8} height={size * 0.8} fill="currentColor">
      <path d="M7.164 16.836a8 8 0 1 1 9.672 0L12 20l-4.836-3.164Z" opacity="0.3" />
      <text x="12" y="13" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">
        AWS
      </text>
    </svg>
  </div>
);

const AwsIcon = memo(({ iconName, size = 24, className }: AwsIconProps) => {
  if (!iconName) return <NotFound size={size} className={className} />;

  const LazyIcon = getLazyIcon(iconName);

  return (
    <Suspense fallback={<Fallback size={size} className={className} />}>
      <div style={{ width: size, height: size }} className={className}>
        <LazyIcon size={size} />
      </div>
    </Suspense>
  );
});

AwsIcon.displayName = "AwsIcon";

export default AwsIcon;
