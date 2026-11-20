import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep } from "@/features/diagram";
import {
  conditionKindOf,
  endpointLabel,
  findEndpointMismatch,
  isEndpointComponent,
  useComponents,
  useConnections,
} from "@/features/diagram";
import { CONDITION_KIND_LABEL, conditionGlyph } from "../conditionKinds";

/** One route an author can point a step at, already named for a list. */
interface EndpointOption {
  id: string;
  /** `POST /urls`. */
  label: string;
  /** The api-group it hangs off, so two services with the same path stay apart. */
  groupName: string;
}

/** A step claiming a route its own call does not arrive at, in names. */
interface RouteMismatch {
  arrivesAt: string;
  belongsTo: string;
}

/**
 * How the script names its steps, shared by the list and the step's own panel so the two never
 * disagree on what a step is called.
 */
export function useStepNaming() {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();

  /** What the step points at, ignoring the author's title — the fallback a title replaces. */
  const subjectOf = useCallback(
    (step: FlowStep): string => {
      if (step.branches && step.branches.length > 0) {
        const kind = conditionKindOf(step);
        return `${conditionGlyph(kind)} ${step.conditionLabel?.trim() || t(CONDITION_KIND_LABEL[kind])}`;
      }
      if (step.connectionId) {
        const connection = connections[step.connectionId];
        if (connection) return `${t("flowScript.connectionPrefix")}${connection.label}`;
      }
      if (step.componentId) {
        return components[step.componentId]?.name ?? t("flowScript.unknownStep");
      }
      if (step.description?.trim()) return step.description;
      return t("flowScript.emptyStep");
    },
    [components, connections, t],
  );

  /** The call a step makes and where it lands, for a folded section ("POST /x → API"). */
  const callOf = useCallback(
    (step: FlowStep): { label: string; target: string | null } | null => {
      const connection = step.connectionId ? connections[step.connectionId] : undefined;
      if (!connection) return null;
      const arrivesAt =
        step.payloadDirection === "response" ? connection.sourceId : connection.targetId;
      return {
        label: connection.label || connection.technology || t("common.connection"),
        target: components[arrivesAt]?.name ?? null,
      };
    },
    [components, connections, t],
  );

  /**
   * Every route on the diagram, named the way a list of routes reads.
   *
   * The group's name comes along because two services can serve the same path, and `POST /urls`
   * on its own would then name two different operations.
   */
  const endpoints = useMemo<EndpointOption[]>(() => {
    const options: EndpointOption[] = [];
    for (const component of Object.values(components)) {
      if (!isEndpointComponent(component)) continue;
      const group = component.parentId ? components[component.parentId] : undefined;
      options.push({
        id: component.id,
        label: endpointLabel(component),
        groupName: group?.name ?? t("flowScript.routeUngrouped"),
      });
    }
    return options.sort(
      (a, b) => a.groupName.localeCompare(b.groupName) || a.label.localeCompare(b.label),
    );
  }, [components, t]);

  const routeMismatchOf = useCallback(
    (step: FlowStep): RouteMismatch | null => {
      const mismatch = findEndpointMismatch(step, components, connections);
      if (!mismatch) return null;
      return {
        arrivesAt: components[mismatch.arrivesAtId]?.name ?? t("flowScript.unknownStep"),
        belongsTo: components[mismatch.belongsToId]?.name ?? t("flowScript.unknownStep"),
      };
    },
    [components, connections, t],
  );

  return { subjectOf, callOf, endpoints, routeMismatchOf };
}
