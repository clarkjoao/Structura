import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Diagram } from "@/features/diagram";
import {
  cloneDiagramForImportWithId,
  formatDiagramImportCalendarDate,
  resolveUniqueDiagramId,
  useDiagramActions,
  useDiagramStore,
} from "@/features/diagram";
import { ViewerCanvas } from "./ViewerCanvas";
import SharedDiagramBanner from "./SharedDiagramBanner";

interface SharedDiagramViewProps {
  diagram: Diagram;
}

export function SharedDiagramView({ diagram }: SharedDiagramViewProps) {
  const { t } = useTranslation();
  const diagrams = useDiagramStore(useShallow((state) => state.diagrams));
  const { addImportedDiagram } = useDiagramActions();
  const [imported, setImported] = useState(false);

  const getAppBaseUrl = () => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${basePath}`;
  };

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
      <ViewerCanvas diagram={diagram} offsetTop={44} showOpenInStructuraButton={false} />
    </div>
  );
}
