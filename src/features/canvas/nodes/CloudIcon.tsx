import { memo } from "react";
import CloudIconBase from "@/features/cloud/components/CloudIcon";

/**
 * Canvas-facing alias of the unified `CloudIcon`.
 *
 * Kept so existing `providerId` call sites (and `AwsIcon`) keep compiling;
 * both resolve through the same family `IconResolver` path. F5 retires the
 * AWS-only wrapper once every importer has moved.
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

interface AwsIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

/** @deprecated Thin AWS wrapper — F5 removes the remaining call sites. */
export const AwsIcon = memo(({ iconName, size = 24, className }: AwsIconProps) => (
  <CloudIcon providerId="aws" iconName={iconName} size={size} className={className} />
));

AwsIcon.displayName = "AwsIcon";
