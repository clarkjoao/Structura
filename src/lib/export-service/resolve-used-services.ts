import type { Component, ServiceDefinition, ServiceManifestEntry } from "@/features/diagram";

function toManifestEntry(service: ServiceDefinition): ServiceManifestEntry {
  const github = service.metadata?.github;

  return {
    id: service.id,
    name: service.name,
    repositoryUrl: service.repositoryUrl,
    technology: service.technology,
    ...(service.owner ? { owner: service.owner } : {}),
    ...(service.tags?.length ? { tags: service.tags } : {}),
    ...(service.sources?.length ? { sources: service.sources } : {}),
    ...(github ? { github: { repoId: github.repoId, fullName: github.fullName } } : {}),
  };
}

/**
 * Collect the services the diagram actually references, the way `resolveUsedIconLibrary`
 * collects the icons it uses. Exporting the whole catalog would leak unrelated services into
 * a shared file, so only what the components point at travels with the diagram.
 */
export function resolveUsedServices(
  components: Record<string, Component>,
  serviceCatalog: Record<string, ServiceDefinition>,
): ServiceManifestEntry[] {
  const seen = new Set<string>();
  const entries: ServiceManifestEntry[] = [];

  for (const component of Object.values(components)) {
    const serviceId = component.serviceId;
    if (!serviceId || seen.has(serviceId)) continue;
    seen.add(serviceId);

    const service = serviceCatalog[serviceId];
    if (service) entries.push(toManifestEntry(service));
  }

  return entries;
}
