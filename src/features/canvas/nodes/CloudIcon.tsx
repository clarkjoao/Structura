import { memo, Suspense, type ComponentType } from "react";
import { Cloud } from "lucide-react";
import { cloudRegistry } from "@/features/cloud/registry/cloud.registry";
import type { IconResolver } from "@/features/cloud/model/cloud.types";

type IconComponent = ComponentType<{ size?: number | string }>;

interface CloudIconProps {
  providerId: "aws" | "gcp" | "azure";
  iconName: string;
  size?: number;
  className?: string;
}

const FALLBACK_ICONS: Record<string, IconComponent> = {
  aws: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
      <text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor">
        AWS
      </text>
    </svg>
  ),
  gcp: Cloud,
  azure: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
      <text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor">
        AZ
      </text>
    </svg>
  ),
};

const LoadingFallback = ({ size, className }: { size: number; className?: string }) => (
  <div
    className={`animate-pulse rounded bg-muted ${className ?? ""}`}
    style={{ width: size, height: size }}
  />
);

const CloudIconInner = ({
  resolver,
  iconName,
  size,
  className,
}: {
  resolver: IconResolver;
  iconName: string;
  size: number;
  className?: string;
}) => {
  if (!iconName) {
    const Fallback = resolver.Fallback;
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <Fallback size={size * 0.8} />
      </div>
    );
  }

  const LazyIcon = resolver.resolve(iconName);
  if (!LazyIcon) {
    const Fallback = resolver.Fallback;
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <Fallback size={size * 0.8} />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback size={size} className={className} />}>
      <div style={{ width: size, height: size }} className={className}>
        <LazyIcon size={size} />
      </div>
    </Suspense>
  );
};

const CloudIcon = memo(({ providerId, iconName, size = 24, className }: CloudIconProps) => {
  const provider = cloudRegistry.forId(providerId);
  if (!provider) {
    const Fallback = FALLBACK_ICONS[providerId] ?? Cloud;
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <Fallback size={size * 0.8} />
      </div>
    );
  }

  return (
    <CloudIconInner
      resolver={provider.iconResolver}
      iconName={iconName}
      size={size}
      className={className}
    />
  );
});

CloudIcon.displayName = "CloudIcon";

export default CloudIcon;

// Thin wrapper for existing AWS-only consumers
interface AwsIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

export const AwsIcon = memo(({ iconName, size = 24, className }: AwsIconProps) => (
  <CloudIcon providerId="aws" iconName={iconName} size={size} className={className} />
));

AwsIcon.displayName = "AwsIcon";
