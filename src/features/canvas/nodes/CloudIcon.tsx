import { memo } from "react";
import CloudIconBase from "@/features/cloud/components/CloudIcon";

/**
 * Canvas-facing alias of the unified `CloudIcon`.
 *
 * Call sites that previously used the AWS-only `AwsIcon` wrapper now pass
 * `providerId="aws"` here — same resolver path as GCP/Azure.
 */
interface CloudIconProps {
  providerId: "aws" | "gcp" | "azure";
  iconName: string;
  size?: number;
  className?: string;
}

const CloudIcon = memo(({ providerId, iconName, size = 24, className }: CloudIconProps) => (
  <CloudIconBase familyId={providerId} iconName={iconName} size={size} className={className} />
));

CloudIcon.displayName = "CloudIcon";

export default CloudIcon;
