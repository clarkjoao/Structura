import type { ApiGroupComponent, Component, EndpointComponent } from "../model/component.types";
import { isApiGroupComponent, isEndpointComponent } from "../model/component.guards";
import type { Connection } from "../model/connection.types";
import type { Flow, FlowStep } from "../model/flow.types";
import { walkFlow } from "./flow-traversal";

/**
 * The route a step calls, and the routes a script exercises.
 *
 * One field is stored — `FlowStep.endpointId` — and both directions are read
 * off it. The endpoint never learns who calls it, which is what makes deleting
 * a step safe: there is no second copy of the fact to go stale, the way an
 * `EndpointHandler.flowId` does when the flow it names is deleted.
 */

/** `POST /urls`. The group's base path is deliberately left off — see below. */
export function endpointLabel(endpoint: EndpointComponent): string {
  return `${endpoint.method} ${endpoint.path}`.trim();
}

/**
 * What a step's endpoint reference resolves to.
 *
 * Three states rather than a nullable endpoint, because *naming nothing* and
 * *naming something that is gone* are different facts and the reading says
 * different things about them. A step whose route was deleted has to say so;
 * falling back silently would leave the author believing the link survived.
 */
export type StepEndpointState =
  | { kind: "none" }
  | { kind: "gone"; endpointId: string }
  | {
      kind: "present";
      endpoint: EndpointComponent;
      /** The api-group the route hangs off, when it still has one. */
      group: ApiGroupComponent | null;
      /** `POST /urls`, ready to head a step. */
      label: string;
    };

export function resolveStepEndpoint(
  step: FlowStep | null | undefined,
  components: Record<string, Component>,
): StepEndpointState {
  const endpointId = step?.endpointId;
  if (!endpointId) return { kind: "none" };

  const component = components[endpointId];
  // An id that names something which is not an endpoint is as gone as one that
  // names nothing: whatever it points at, the route it claimed is not there.
  if (!component || !isEndpointComponent(component)) return { kind: "gone", endpointId };

  const parent = component.parentId ? components[component.parentId] : undefined;
  return {
    kind: "present",
    endpoint: component,
    group: parent && isApiGroupComponent(parent) ? parent : null,
    label: endpointLabel(component),
  };
}

/** One place a route is called from. */
export interface EndpointCall {
  flowId: string;
  flowName: string;
  stepId: string;
}

/**
 * Every step, in every script, that calls this route.
 *
 * Walked on each request rather than kept anywhere. The flows are tens of steps
 * long and this is asked once per endpoint node, so the walk is cheaper than
 * the bookkeeping an index would need to stay honest through a deletion.
 */
export function endpointCallers(flows: readonly Flow[], endpointId: string): EndpointCall[] {
  const calls: EndpointCall[] = [];
  for (const flow of flows) {
    walkFlow(flow, (step) => {
      if (step.endpointId === endpointId) {
        calls.push({ flowId: flow.id, flowName: flow.name, stepId: step.id });
      }
    });
  }
  return calls;
}

/**
 * Every route called by any of these scripts, indexed by route.
 *
 * One walk for the whole diagram rather than one per route: the canvas asks
 * this for every endpoint node it builds, and the flows are the same flows each
 * time.
 */
export function endpointCallersByRoute(flows: readonly Flow[]): Map<string, EndpointCall[]> {
  const byRoute = new Map<string, EndpointCall[]>();
  for (const flow of flows) {
    walkFlow(flow, (step) => {
      if (!step.endpointId) return;
      const calls = byRoute.get(step.endpointId);
      const call = { flowId: flow.id, flowName: flow.name, stepId: step.id };
      if (calls) calls.push(call);
      else byRoute.set(step.endpointId, [call]);
    });
  }
  return byRoute;
}

/** A step claiming a route that the call it makes does not arrive at. */
export interface EndpointMismatch {
  /** The component the call lands on. */
  arrivesAtId: string;
  /** The component the route belongs to — its group, or the route itself. */
  belongsToId: string;
}

/**
 * Whether the route a step names is where its call actually arrives.
 *
 * A connection is drawn in the direction of the call, so the route being
 * exercised belongs at its target — on the way out *and* on the way back, since
 * a response travels the same edge from the same callee.
 *
 * Reported and never enforced. A gateway forwarding to a service behind it, or
 * a call drawn between containers against a route that lives a level down, are
 * both ordinary, which is why the parent chain is walked rather than only the
 * immediate owner — and why disagreeing is a remark rather than an error.
 */
export function findEndpointMismatch(
  step: FlowStep | null | undefined,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): EndpointMismatch | null {
  if (!step?.endpointId || !step.connectionId) return null;

  const endpoint = components[step.endpointId];
  const connection = connections[step.connectionId];
  if (!endpoint || !isEndpointComponent(endpoint) || !connection) return null;

  const arrivesAtId = connection.targetId;

  let owner: Component | undefined = endpoint;
  const seen = new Set<string>();
  while (owner && !seen.has(owner.id)) {
    if (owner.id === arrivesAtId) return null;
    seen.add(owner.id);
    owner = owner.parentId ? components[owner.parentId] : undefined;
  }

  const group = endpoint.parentId ? components[endpoint.parentId] : undefined;
  return { arrivesAtId, belongsToId: group?.id ?? endpoint.id };
}
