import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Diagram } from "@/features/diagram/model";
import type { ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import {
  cloneDiagramForImportWithId,
  formatDiagramImportCalendarDate,
  resolveUniqueDiagramId,
} from "@/features/diagram/utils";
import { useDiagramActions, useDiagramStore } from "@/features/diagram/store";
import { getAppBaseUrl } from "@/lib/share-url";
import { ViewerCanvas } from "./ViewerCanvas";
import SharedDiagramBanner from "./SharedDiagramBanner";

interface SharedDiagramViewProps {
  diagram: Diagram;
  /** The names the link carried beside the diagram. Not imported: the store has its own. */
  catalog: ReaderCatalog;
  /** The script the link named, already checked against this diagram. */
  flowId?: string | null;
}

export function SharedDiagramView({ diagram, catalog, flowId = null }: SharedDiagramViewProps) {
  const { t } = useTranslation();
  const diagrams = useDiagramStore(useShallow((state) => state.diagrams));
  const { addImportedDiagram } = useDiagramActions();
  const [imported, setImported] = useState(false);

  const handleImport = () => {
    const now = Date.now();
    const importDateLabel = formatDiagramImportCalendarDate(new Date());
    const targetId = resolveUniqueDiagramId(diagram.id, diagrams);
    const displayName = t("share.importedDiagramName", {
      name: diagram.name,
      date: importDateLabel,
    });
    const importedDiagram = cloneDiagramForImportWithId(diagram, targetId, {
      name: displayName,
      updatedAt: now,
    });

    const savedDiagram = addImportedDiagram(importedDiagram);
    setImported(true);
    window.location.assign(`${getAppBaseUrl()}/model/${savedDiagram.id}`);
  };

  const handleClose = () => {
    window.location.assign(`${getAppBaseUrl()}/workspace`);
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {!imported ? (
        <SharedDiagramBanner
          diagramName={diagram.name}
          onImport={handleImport}
          onClose={handleClose}
        />
      ) : null}
      <ViewerCanvas
        diagram={diagram}
        catalog={catalog}
        offsetTop={44}
        showOpenInStructuraButton={false}
        initialFlowId={flowId}
      />
    </div>
  );
}
