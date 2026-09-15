import { Suspense, memo, type ComponentType } from "react";
import { Cloud, Network } from "lucide-react";
import { cloudRegistry } from "../registry/cloud.registry";
import type { IconResolver } from "../model/cloud.types";
import { iconResolverForFamily } from "@/features/elements/families/family-icon-resolvers";

type IconComponent = ComponentType<{ size?: number | string }>;

/**
 * Unified cloud icon.
 *
 * Driven by a family id + icon name (what `palette.icon: { kind: "family" }`
 * carries), or by a component type + service icon (what CardNode already
 * had). Both paths end at an `IconResolver` — the same contract AWS/Azure
 * (npm packages) and GCP (`import.meta.glob` SVGs) already implement.
 */
type CloudIconProps =
  | {
      familyId: string;
      iconName: string;
      size?: number;
      className?: string;
      componentType?: never;
      serviceIconName?: never;
    }
  | {
      componentType: string;
      serviceIconName?: string;
      size?: number;
      className?: string;
      familyId?: never;
      iconName?: never;
    };

const FALLBACK_BY_FAMILY: Record<string, IconComponent> = {
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

const Skeleton = ({ size, className }: { size: number; className?: string }) => (
  <div
    className={`animate-pulse rounded bg-muted ${className ?? ""}`}
    style={{ width: size, height: size }}
  />
);

function resolverForFamily(familyId: string): IconResolver | undefined {
  return iconResolverForFamily(familyId) ?? cloudRegistry.forId(familyId)?.iconResolver;
}

function renderResolved(
  resolver: IconResolver,
  iconName: string | undefined,
  size: number,
  className: string | undefined,
) {
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
    <Suspense fallback={<Skeleton size={size} className={className} />}>
      <div style={{ width: size, height: size }} className={className}>
        <LazyIcon size={size} />
      </div>
    </Suspense>
  );
}

const CloudIcon = memo((props: CloudIconProps) => {
  const size = props.size ?? 24;
  const { className } = props;

  if (props.familyId !== undefined) {
    const resolver = resolverForFamily(props.familyId);
    if (!resolver) {
      const Fallback = FALLBACK_BY_FAMILY[props.familyId] ?? Network;
      return (
        <div
          className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
          style={{ width: size, height: size }}
        >
          <Fallback size={size * 0.8} />
        </div>
      );
    }
    return renderResolved(resolver, props.iconName, size, className);
  }

  const provider = cloudRegistry.forType(props.componentType);
  if (!provider) {
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <Network size={size * 0.8} />
      </div>
    );
  }

  return renderResolved(provider.iconResolver, props.serviceIconName, size, className);
});

CloudIcon.displayName = "CloudIcon";

export default CloudIcon;
