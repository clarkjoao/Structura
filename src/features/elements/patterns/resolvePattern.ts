import i18n from "@/infrastructure/i18n";
import {
  PATTERN_CELL_H,
  PATTERN_CELL_W,
  PATTERN_FRAME_PAD_BOTTOM,
  PATTERN_FRAME_PAD_TOP,
  PATTERN_FRAME_PAD_X,
  UNSIZED_NODE_EXTENT_H,
  UNSIZED_NODE_EXTENT_W,
} from "@/features/diagram/model/layout.constants";
import type {
  PatternFragment,
  PatternFragmentNode,
} from "@/features/diagram/model/pattern-fragment.types";
import {
  PATTERNS,
  type PatternNode,
  type PatternRole,
  type PatternTemplate,
} from "@/lib/catalogs/patterns";
import type { ComponentType } from "@/features/diagram/model/component.types";
import { familiesResolving, serviceForConcept } from "../roles";

/** What a role or an untyped node is without a provider: a C4 container. */
const NEUTRAL_TYPE: ComponentType = "container";

/** No provider: every role is a C4 container naming its job. */
export const NEUTRAL_PROVIDER = "neutral";

/** `NEUTRAL_PROVIDER`, or the id of a registered catalog family (aws, gcp, azure…). */
export type PatternProvider = string;

export function patternNameKey(pattern: PatternTemplate): string {
  return `patterns.items.${pattern.id}.name`;
}

export function patternDescriptionKey(pattern: PatternTemplate): string {
  return `patterns.items.${pattern.id}.description`;
}

export function patternNodeKey(pattern: PatternTemplate, node: PatternNode): string {
  return `patterns.items.${pattern.id}.nodes.${node.key}`;
}

export function patternRoleKey(r: PatternRole): string {
  return `patterns.roles.${r}`;
}

/** The link for the active language, or the English one. */
export function patternReference(pattern: PatternTemplate, language: string): string {
  const localized = language === "pt-BR" ? pattern.references["pt-BR"] : undefined;
  return localized ?? pattern.references.en;
}

/**
 * The element a role becomes with `provider`: that family's service for it,
 * or — neutral, or a gap in the family — a container whose technology names
 * the role. Never a guessed service id.
 */
export function resolveRole(
  r: PatternRole,
  provider: PatternProvider,
): Pick<PatternFragmentNode, "type" | "createOptions" | "technology"> {
  const service = provider === NEUTRAL_PROVIDER ? null : serviceForConcept(provider, r);
  if (service) return { type: service.type, createOptions: { serviceId: service.serviceId } };
  return { type: NEUTRAL_TYPE, createOptions: {}, technology: i18n.t(patternRoleKey(r)) };
}

function cellOrigin(node: PatternNode, inParent: boolean): { x: number; y: number } {
  const x = node.col * PATTERN_CELL_W;
  const y = node.row * PATTERN_CELL_H;
  return inParent ? { x: PATTERN_FRAME_PAD_X + x, y: PATTERN_FRAME_PAD_TOP + y } : { x, y };
}

/**
 * A pattern made concrete for `provider`, in the active language: labels
 * resolved, roles turned into elements, cells into positions, each boundary
 * sized to the cells its children use.
 */
export function resolvePattern(
  pattern: PatternTemplate,
  provider: PatternProvider = NEUTRAL_PROVIDER,
): PatternFragment {
  const indexByKey = new Map(pattern.nodes.map((node, index) => [node.key, index]));

  const nodes = pattern.nodes.map((node): PatternFragmentNode => {
    const parentIndex = node.parent === undefined ? null : (indexByKey.get(node.parent) ?? null);
    const element = node.role
      ? resolveRole(node.role, provider)
      : { type: node.type ?? NEUTRAL_TYPE, createOptions: node.createOptions ?? {} };
    const children = pattern.nodes.filter((candidate) => candidate.parent === node.key);
    const size =
      children.length === 0
        ? {}
        : {
            width:
              PATTERN_FRAME_PAD_X * 2 +
              Math.max(...children.map((child) => child.col)) * PATTERN_CELL_W +
              UNSIZED_NODE_EXTENT_W,
            height:
              PATTERN_FRAME_PAD_TOP +
              Math.max(...children.map((child) => child.row)) * PATTERN_CELL_H +
              UNSIZED_NODE_EXTENT_H +
              PATTERN_FRAME_PAD_BOTTOM,
          };
    return {
      ...element,
      name: i18n.t(patternNodeKey(pattern, node)),
      parentIndex,
      ...cellOrigin(node, parentIndex !== null),
      ...size,
    };
  });

  const topLevel = nodes.filter((node) => node.parentIndex === null);
  const width = Math.max(...topLevel.map((node) => node.x + (node.width ?? UNSIZED_NODE_EXTENT_W)));
  const height = Math.max(
    ...topLevel.map((node) => node.y + (node.height ?? UNSIZED_NODE_EXTENT_H)),
  );

  return {
    patternId: pattern.id,
    nodes,
    edges: pattern.edges.map((e) => ({
      from: indexByKey.get(e.from) ?? -1,
      to: indexByKey.get(e.to) ?? -1,
      label: i18n.t(`patterns.edges.${e.label}`),
    })),
    width,
    height,
  };
}

/**
 * The providers a pattern can be inserted with: neutral, then every catalog
 * family that has a service for at least one role the catalog uses. Read at
 * call time — the registry is filled at boot.
 */
export function patternProviders(): PatternProvider[] {
  const roles = [
    ...new Set(
      PATTERNS.flatMap((pattern) => pattern.nodes.flatMap((n) => (n.role ? [n.role] : []))),
    ),
  ];
  return [NEUTRAL_PROVIDER, ...familiesResolving(roles).map((family) => family.id)];
}

export function isPatternProvider(value: string): boolean {
  return patternProviders().includes(value);
}
