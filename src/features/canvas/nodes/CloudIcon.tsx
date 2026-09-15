import { memo } from "react";
import CloudIconBase from "@/features/cloud/components/CloudIcon";

/**
 * Canvas-facing alias of the unified `CloudIcon`.
 *
 * `providerId` is any registered cloud family id (open string), not a closed
 * aws|gcp|azure union — same contract as `registerCloudFamily`.
 */
interface CloudIconProps {
  providerId: string;
  iconName: string;
  size?: number;
  className?: string;
}

const CloudIcon = memo(({ providerId, iconName, size = 24, className }: CloudIconProps) => (
  <CloudIconBase familyId={providerId} iconName={iconName} size={size} className={className} />
));

CloudIcon.displayName = "CloudIcon";

export default CloudIcon;
