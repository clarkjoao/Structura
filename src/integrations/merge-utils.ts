import { ServiceSource } from "@/features/diagram";
import type {
  ServiceDefinition,
  ServiceSourceRef,
} from "@/features/diagram/model/service.types";

/**
 * Utilitários compartilhados entre integrações para merge de serviços.
 */

export function dedupeStringsPreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

export function pickMoreCompleteString(a: string, b: string): string {
  const la = a?.trim().length ?? 0;
  const lb = b?.trim().length ?? 0;
  if (la === lb) return a || b;
  return la > lb ? a : b;
}

/**
 * Normaliza repositoryUrl para comparação robusta entre fontes (GitHub, DefectDojo, manual).
 * Remove: trailing slashes, .git suffix, protocolo ssh/https, www prefix, e converte para lowercase.
 */
export function normalizeRepoUrl(url: string | undefined): string {
  if (!url) return "";
  let normalized = url.trim().toLowerCase();

  // Normalize SSH URLs: git@github.com:org/repo → github.com/org/repo
  normalized = normalized.replace(/^git@([^:]+):/, "$1/");

  // Remove protocol
  normalized = normalized.replace(/^(?:https?|ssh|git):\/\//, "");

  // Remove www. prefix
  normalized = normalized.replace(/^www\./, "");

  // Remove trailing slashes and .git suffix
  normalized = normalized.replace(/\/+$/, "").replace(/\.git$/, "");

  return normalized;
}

/**
 * Compara dois repositoryUrls normalizados.
 */
export function repoUrlsMatch(
  a: string | undefined,
  b: string | undefined,
): boolean {
  const na = normalizeRepoUrl(a);
  const nb = normalizeRepoUrl(b);
  return na !== "" && na === nb;
}

export function normalizeSources(
  svc: Pick<ServiceDefinition, "source" | "sourceId" | "sources">,
): ServiceSourceRef[] {
  if (svc.sources && svc.sources.length > 0) return svc.sources;
  if (svc.source) return [{ type: svc.source, sourceId: svc.sourceId }];
  return [{ type: ServiceSource.Manual }];
}

export function mergeSources(
  existing: ServiceDefinition["sources"],
  incoming: ServiceDefinition["sources"],
): NonNullable<ServiceDefinition["sources"]> {
  const merged = [...(existing ?? []), ...(incoming ?? [])];
  const seen = new Set<string>();
  return merged.filter((source) => {
    if (seen.has(source.type)) return false;
    seen.add(source.type);
    return true;
  });
}
