/**
 * Utilitários compartilhados entre integrações para merge de serviços.
 */

export function dedupeStringsPreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
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
 * Normaliza repositoryUrl para comparação: remove trailing slashes, .git, e lowercase.
 */
export function normalizeRepoUrl(url: string | undefined): string {
  if (!url) return "";
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .toLowerCase();
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
