import type { CloudProviderAdapter } from "../model/cloud.types";

/**
 * Derived view of catalog-shaped families for CardNode / CloudIcon /
 * ComponentPanel.
 *
 * Providers are not curated here — `registerCloudFamily` pushes an adapter
 * built from the family definition. Adding a family must not require editing
 * this module or `cloud/bootstrap.ts`.
 */
class CloudProviderRegistry {
  private readonly providers = new Map<string, CloudProviderAdapter>();

  register(provider: CloudProviderAdapter): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  forId(providerId: string): CloudProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  forType(componentType: string): CloudProviderAdapter | undefined {
    for (const provider of this.providers.values()) {
      if (provider.matchesType(componentType)) return provider;
    }
    return undefined;
  }

  isCloudType(type: string): boolean {
    return this.forType(type) !== undefined;
  }

  allProviders(): CloudProviderAdapter[] {
    return [...this.providers.values()];
  }
}

export const cloudRegistry = new CloudProviderRegistry();
