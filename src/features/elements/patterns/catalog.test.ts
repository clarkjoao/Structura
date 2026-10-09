import { describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import { PATTERN_CATEGORIES, PATTERNS, type PatternTemplate } from "@/lib/catalogs/patterns";
import { canBeConnectionSource } from "@/features/diagram/model/connection-rules";
import {
  UNSIZED_NODE_EXTENT_H,
  UNSIZED_NODE_EXTENT_W,
} from "@/features/diagram/model/layout.constants";
import { isRegisteredElementType } from "../element.registry";
import { canContain } from "../containment";
import { CATALOG_CONCEPTS } from "../search/concepts";
import { serviceForConcept } from "../roles";
import {
  NEUTRAL_PROVIDER,
  patternDescriptionKey,
  patternNameKey,
  patternNodeKey,
  patternProviders,
  patternRoleKey,
  resolvePattern,
} from "./resolvePattern";

const LOCALES = ["en", "pt-BR"] as const;
const PROVIDERS = [NEUTRAL_PROVIDER, "aws", "gcp", "azure"] as const;

/**
 * Behavioral patterns, not fragments (audit Tier C): they are one box and a
 * note, better said as an annotation. They must not come back as patterns.
 */
const TIER_C = [
  "retry",
  "retry-with-fallback",
  "rate-limiting",
  "throttling",
  "idempotent-consumer",
  "health-endpoint-monitoring",
  "leader-election",
  "index-table",
  "sequential-convoy",
  "compute-resource-consolidation",
  "scheduler-agent-supervisor",
  "quarantine",
  "compensating-transaction",
  "feature-flag-rollout",
  "circuit-breaker",
  "fifo-queue-aws",
  "fifo-queue-kafka",
];

/** The roles each family has no service for (audit §4); only these fall back to neutral. */
const DECLARED_GAPS: Record<string, readonly string[]> = {
  aws: [],
  azure: [],
  gcp: [
    "queue",
    "topic",
    "event-bus",
    "stream",
    "cache",
    "nosql-db",
    "cdn",
    "load-balancer",
    "dns",
    "workflow",
    "identity",
    "secrets",
  ],
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function absoluteRects(pattern: PatternTemplate): Rect[] {
  const fragment = resolvePattern(pattern);
  const rects: Rect[] = [];
  fragment.nodes.forEach((node, i) => {
    const parent = node.parentIndex === null ? null : rects[node.parentIndex];
    rects[i] = {
      x: (parent?.x ?? 0) + node.x,
      y: (parent?.y ?? 0) + node.y,
      w: node.width ?? UNSIZED_NODE_EXTENT_W,
      h: node.height ?? UNSIZED_NODE_EXTENT_H,
    };
  });
  return rects;
}

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

describe("the pattern catalog", () => {
  it("has unique ids, none of them behavioral", () => {
    const ids = PATTERNS.map((pattern) => pattern.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => TIER_C.includes(id))).toEqual([]);
    expect(PATTERNS.every((pattern) => PATTERN_CATEGORIES.includes(pattern.category))).toBe(true);
  });

  it("offers neutral and every family that can stand in for its roles", () => {
    const providers = patternProviders();
    expect(providers[0]).toBe(NEUTRAL_PROVIDER);
    expect(providers).toEqual(expect.arrayContaining(["aws", "gcp", "azure"]));
    expect(providers).not.toContain("k8s");
  });

  describe.each(PATTERNS.map((pattern) => [pattern.id, pattern] as const))("%s", (_, pattern) => {
    it("is well formed: keys, edges, parents, element types", () => {
      const keys = pattern.nodes.map((node) => node.key);
      expect(new Set(keys).size).toBe(keys.length);
      pattern.nodes.forEach((node, i) => {
        expect(!(node.role && node.type), `${node.key}: role or type, not both`).toBe(true);
        if (node.role) expect(CATALOG_CONCEPTS).toContain(node.role);
        if (node.type) expect(isRegisteredElementType(node.type), node.type).toBe(true);
        if (node.parent) {
          const parentAt = keys.indexOf(node.parent);
          expect(parentAt, `${node.key}: parent first`).toBeGreaterThanOrEqual(0);
          expect(parentAt).toBeLessThan(i);
        }
      });
      for (const e of pattern.edges) {
        expect(keys, e.from).toContain(e.from);
        expect(keys, e.to).toContain(e.to);
      }
      expect(pattern.references.en).toMatch(/^https:\/\//);
    });

    it("resolves to registered elements for every provider, falling back only on declared gaps", () => {
      for (const provider of PROVIDERS) {
        const fragment = resolvePattern(pattern, provider);
        fragment.nodes.forEach((node, i) => {
          expect(isRegisteredElementType(node.type), `${provider} ${node.type}`).toBe(true);
          if (node.parentIndex !== null) {
            const parent = fragment.nodes[node.parentIndex];
            expect(canContain(parent.type, node.type), `${parent.type} ⊃ ${node.type}`).toBe(true);
          }
          const r = pattern.nodes[i].role;
          if (r && provider !== NEUTRAL_PROVIDER) {
            const fellBack = node.createOptions.serviceId === undefined;
            expect(fellBack, `${provider} ${r}`).toBe(DECLARED_GAPS[provider].includes(r));
            if (!fellBack) {
              expect(node.createOptions.serviceId).toBe(serviceForConcept(provider, r)?.serviceId);
            }
          }
        });
        for (const e of fragment.edges) {
          expect(canBeConnectionSource(fragment.nodes[e.from].type)).toBe(true);
        }
      }
    });

    it("has no overlapping nodes, and boundaries hold their children", () => {
      const rects = absoluteRects(pattern);
      pattern.nodes.forEach((a, i) => {
        pattern.nodes.forEach((b, j) => {
          if (j <= i) return;
          const related = a.key === b.parent || b.key === a.parent;
          if (related) return;
          // Nested anywhere under the same boundary chain is checked by `inside`.
          expect(overlap(rects[i], rects[j]), `${a.key} × ${b.key}`).toBe(false);
        });
        if (a.parent) {
          const parent = rects[pattern.nodes.findIndex((n) => n.key === a.parent)];
          expect(inside(rects[i], parent), `${a.key} inside ${a.parent}`).toBe(true);
        }
      });
    });

    it.each(LOCALES)("is translated in %s", (lng) => {
      const keys = [
        patternNameKey(pattern),
        patternDescriptionKey(pattern),
        `patterns.category.${pattern.category}`,
        ...pattern.nodes.map((node) => patternNodeKey(pattern, node)),
        ...pattern.nodes.flatMap((node) => (node.role ? [patternRoleKey(node.role)] : [])),
        ...pattern.edges.map((e) => `patterns.edges.${e.label}`),
      ];
      for (const key of keys) {
        expect(i18n.exists(key, { lng, fallbackLng: false }), key).toBe(true);
      }
      if (pattern.references["pt-BR"]) expect(pattern.references["pt-BR"]).toMatch(/^https:\/\//);
    });
  });
});
