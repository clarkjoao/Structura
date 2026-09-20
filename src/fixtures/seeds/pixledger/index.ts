import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { buildCatalogDiagram } from "./catalog";
import { buildContextDiagram } from "./context";
import { buildHubContainerDiagram } from "./container-hub";
import { buildLedgerContainerDiagram } from "./container-ledger";
import { buildMerchantContainerDiagram } from "./container-merchant";
import { buildRiskContainerDiagram } from "./container-risk";
import { buildHubDeploymentDiagram } from "./deployment-hub";
import { buildLedgerDeploymentDiagram } from "./deployment-ledger";
import { buildMerchantDeploymentDiagram } from "./deployment-merchant";
import { buildRiskDeploymentDiagram } from "./deployment-risk";
import { buildFolders, buildServices } from "./folders-and-services";
import { SEED_PL_LAID_OUT } from "./layouts.generated";

function withGeneratedLayout(diagram: Diagram): Diagram {
  const slice = SEED_PL_LAID_OUT[diagram.id];
  if (!slice) {
    // Fall back to the builder's hand-tuned layouts so generate-layouts can
    // boot (store slices import this module while regenerating).
    return diagram;
  }

  const components = { ...diagram.snapshot.components };
  for (const [id, order] of Object.entries(slice.handleOrder)) {
    const component = components[id];
    if (!component) continue;
    components[id] = {
      ...component,
      handleOrder: {
        outgoing: order.outgoing,
        incoming: order.incoming,
      },
    };
  }

  // Merge ELK coords onto every live component. Endpoints under api-groups are
  // absent from the ELK graph — keep the builder's relative box for those.
  const nodeLayouts: Diagram["nodeLayouts"] = {};
  for (const id of Object.keys(components)) {
    nodeLayouts[id] = slice.nodeLayouts[id] ?? diagram.nodeLayouts[id]!;
  }

  // Drop stale ids left over from deleted components in layouts.generated.ts.
  return {
    ...diagram,
    snapshot: { ...diagram.snapshot, components },
    nodeLayouts,
    viewport: slice.viewport,
  };
}

export function buildDiagrams(): Record<string, Diagram> {
  const diagrams = [
    buildContextDiagram(),
    buildHubContainerDiagram(),
    buildLedgerContainerDiagram(),
    buildRiskContainerDiagram(),
    buildMerchantContainerDiagram(),
    buildHubDeploymentDiagram(),
    buildLedgerDeploymentDiagram(),
    buildRiskDeploymentDiagram(),
    buildMerchantDeploymentDiagram(),
    buildCatalogDiagram(),
  ].map(withGeneratedLayout);

  return Object.fromEntries(diagrams.map((diagram) => [diagram.id, diagram]));
}

export const SEED_PL_DIAGRAMS: Record<string, Diagram> = buildDiagrams();
export const SEED_PL_FOLDERS: Record<string, Folder> = buildFolders();
export const SEED_PL_SERVICES: Record<string, ServiceDefinition> = buildServices();
