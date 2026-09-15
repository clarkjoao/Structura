import { Database, Network, Server, User, type LucideIcon } from "lucide-react";
import CustomNode from "@/features/canvas/nodes/CustomNode";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CustomNode/buildCardNodeData";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { isC4Component } from "@/features/diagram/model/component.guards";
import type { C4Type } from "@/features/diagram/model/component-type-constants";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import type { ElementDescriptor } from "../../element.types";

/**
 * One C4 Model type — a fixed semantic slot, not a cloud category.
 *
 * C4 has no service catalog and no `cloudServiceId`. The icon is per type
 * (lucide + TypeConfig on the card), not per service. Declared as four
 * descriptors rather than a degenerate `CloudFamilyDefinition` (architecture
 * §2.3(b)).
 */
interface C4TypeSpec {
  id: C4Type;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  /** Matches `src/index.css` (`--node-person`, …) and TypeConfig border classes. */
  accentCssVar: `--node-${C4Type}`;
  searchKeys: readonly string[];
}

const C4_SPECS: readonly C4TypeSpec[] = [
  {
    id: "person",
    labelKey: "quickInsert.typePerson",
    descriptionKey: "elements.person.description",
    icon: User,
    accentCssVar: "--node-person",
    searchKeys: ["person", "actor", "user", "pessoa"],
  },
  {
    id: "system",
    labelKey: "quickInsert.typeSystem",
    descriptionKey: "elements.system.description",
    icon: Network,
    accentCssVar: "--node-system",
    searchKeys: ["system", "software", "sistema"],
  },
  {
    id: "container",
    labelKey: "quickInsert.typeContainer",
    descriptionKey: "elements.container.description",
    icon: Server,
    accentCssVar: "--node-container",
    searchKeys: ["container", "service", "deployable"],
  },
  {
    id: "component",
    labelKey: "quickInsert.typeComponent",
    descriptionKey: "elements.component.description",
    icon: Database,
    accentCssVar: "--node-component",
    searchKeys: ["component", "module", "componente"],
  },
];

/**
 * Materialises the four C4 descriptors.
 *
 * Shared card canvas (`CustomNode` + `buildCardNodeData`); distinct `rfType`
 * per id so React Flow's map and the single-owner rfType invariant stay honest.
 *
 * @example
 * for (const element of buildC4Descriptors()) {
 *   if (!hasElement(element.id)) registerElement(element);
 * }
 */
export function buildC4Descriptors(): ElementDescriptor[] {
  return C4_SPECS.map((spec) => {
    const descriptor: ElementDescriptor = {
      id: spec.id,
      family: "c4",
      labelKey: spec.labelKey,
      descriptionKey: spec.descriptionKey,

      model: {
        createComponent: (base) => ({ ...base, type: spec.id }),
        defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
        patchableKeys: ["technology", "panelColor"],
      },

      canvas: {
        rfType: spec.id,
        component: CustomNode,
        handles: SPREAD_HANDLES,
        role: "card",
        zIndex: 1,
        connectable: true,
        canHaveParent: true,
        canBeParent: false,
        canBeConnectionSource: true,
        // Cards size from content (title + icon); layout is a creation hint.
        derivesSize: true,
        buildData: buildCardNodeData,
        buildStyle: buildCardNodeStyle,
      },

      palette: {
        // Matches ElementCategory.C4 — kept as a literal so this module does
        // not import the canvas enum (same pattern as cloud families).
        categoryId: "c4",
        icon: { kind: "lucide", icon: spec.icon },
        accent: { kind: "token", cssVar: spec.accentCssVar },
        searchKeys: [...spec.searchKeys],
      },

      inspector: {},

      export: {
        drawio: {
          toExportNode: (comp, base) => {
            if (!isC4Component(comp)) {
              throw new Error(
                `[elements] c4 export received a ${comp.type} component; expected a C4 type.`,
              );
            }
            return {
              ...base,
              kind: "c4",
              subtype: comp.type,
              name: comp.name,
              description: comp.description,
              technology: comp.technology,
              serviceId: comp.serviceId,
            };
          },
        },
      },
    };

    return descriptor;
  });
}

/** Descriptors produced by the C4 family — one per C4 Model type. */
export const c4Elements = buildC4Descriptors();
