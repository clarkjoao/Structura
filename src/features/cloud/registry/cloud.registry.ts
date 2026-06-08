import type { CloudProviderAdapter } from "../model/cloud.types";

class CloudProviderRegistry {
  private readonly providers = new Map<string, CloudProviderAdapter>();

  register(provider: CloudProviderAdapter): this {
    this.providers.set(provider.id, provider);
    return this;
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
