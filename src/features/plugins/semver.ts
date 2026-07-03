/**
 * Minimal semver support for plugin manifests: exact versions plus "^", "~", "x" and "*"
 * ranges. Deliberately not a full node-semver implementation (no prerelease ordering,
 * no comparators/unions) — plugins declaring anything fancier fail validation loudly.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const RANGE_RE = /^([~^]?)(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/;

export function parseSemver(input: string): SemVer | null {
  const match = VERSION_RE.exec(input.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function isValidSemver(input: string): boolean {
  return parseSemver(input) !== null;
}

export function isValidSemverRange(input: string): boolean {
  return RANGE_RE.test(input.trim());
}

function compare(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Whether `version` satisfies `range`. Supported ranges: "1.2.3" (exact), "^1", "^1.2",
 * "^1.2.3", "~1.2", "~1.2.3", "1", "1.2", "1.x", "*". Follows npm semantics for "^0.x"
 * (pins the minor when major is 0).
 */
export function semverSatisfies(version: string, range: string): boolean {
  const v = parseSemver(version);
  const match = RANGE_RE.exec(range.trim());
  if (!v || !match) return false;

  const [, operator, majorRaw, minorRaw, patchRaw] = match;
  const isWild = (part: string | undefined) =>
    part === undefined || part === "x" || part === "X" || part === "*";

  if (isWild(majorRaw)) return true;
  const major = Number(majorRaw);
  const minor = isWild(minorRaw) ? null : Number(minorRaw);
  const patch = isWild(patchRaw) ? null : Number(patchRaw);
  const lower: SemVer = { major, minor: minor ?? 0, patch: patch ?? 0 };

  if (compare(v, lower) < 0) return false;

  if (operator === "^") {
    if (major > 0) return v.major === major;
    // ^0.x pins the minor; ^0 alone allows any 0.x.
    if (minor === null) return v.major === 0;
    return v.major === 0 && v.minor === minor;
  }
  if (operator === "~") {
    if (minor === null) return v.major === major;
    return v.major === major && v.minor === minor;
  }
  // No operator: wildcards range, full triple is exact.
  if (minor === null) return v.major === major;
  if (patch === null) return v.major === major && v.minor === minor;
  return compare(v, lower) === 0;
}
