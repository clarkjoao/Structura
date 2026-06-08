import { Suspense, memo } from "react";
import { Network } from "lucide-react";
import { cloudRegistry } from "../registry/cloud.registry";

interface CloudIconProps {
  componentType: string;
  serviceIconName?: string;
  size?: number;
  className?: string;
}

const Skeleton = ({ size, className }: { size: number; className?: string }) => (
  <div
    className={`animate-pulse rounded bg-muted ${className ?? ""}`}
    style={{ width: size, height: size }}
  />
);

const CloudIcon = memo(
  ({ componentType, serviceIconName, size = 24, className }: CloudIconProps) => {
    const provider = cloudRegistry.forType(componentType);

    if (!provider) {
      return (
        <Network
          size={size}
          className={`text-muted-foreground ${className ?? ""}`}
        />
      );
    }

    if (!serviceIconName) {
      const Fallback = provider.iconResolver.Fallback;
      return <Fallback size={size} />;
    }

    const LazyIcon = provider.iconResolver.resolve(serviceIconName);

    if (!LazyIcon) {
      const Fallback = provider.iconResolver.Fallback;
      return <Fallback size={size} />;
    }

    return (
      <Suspense fallback={<Skeleton size={size} className={className} />}>
        <div style={{ width: size, height: size }} className={className}>
          <LazyIcon size={size} />
        </div>
      </Suspense>
    );
  },
);

CloudIcon.displayName = "CloudIcon";

export default CloudIcon;
