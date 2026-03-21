import { AWS_SERVICE_MAP } from "@/lib/catalogs/aws";
import {
  AWS_CATEGORY_MAP_LOCAL,
  AWS_RESICON,
  THEME,
} from "./constants";
import type { AwsServiceInfo } from "./types";

export class AwsServiceCache {
  private cache = new Map<string, AwsServiceInfo>();

  getInfo(serviceId: string): AwsServiceInfo {
    if (!this.cache.has(serviceId)) {
      const catalogEntry = AWS_SERVICE_MAP.get(serviceId);
      const categoryId = catalogEntry?.categoryId ?? "aws-general";
      const categoryKey = AWS_CATEGORY_MAP_LOCAL[categoryId] ?? "general";

      this.cache.set(serviceId, {
        icon: AWS_RESICON[serviceId] ?? "general",
        categoryId,
        color:
          THEME.colors.aws[categoryKey as keyof typeof THEME.colors.aws] ??
          THEME.colors.aws.general,
      });
    }
    return this.cache.get(serviceId)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const awsServiceCache = new AwsServiceCache();
