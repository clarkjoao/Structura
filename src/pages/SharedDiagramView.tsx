import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Diagram } from "@/features/diagram";
import { generateId, useDiagramActions, useDiagramStore } from "@/features/diagram";
import { EmbedCanvas } from "./embed/EmbedCanvas";
import SharedDiagramBanner from "./SharedDiagramBanner";

interface SharedDiagramViewProps {
  diagram: Diagram;
}

const SharedDiagramView = ({ diagram }: SharedDiagramViewProps) => {
  const { t, i18n } = useTranslation();
  const diagrams = useDiagramStore(useShallow((state) => state.diagrams));
  const { addImportedDiagram } = useDiagramActions();
  const [imported, setImported] = useState(false);

  const getAppBaseUrl = () => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${basePath}`;
  };

  const handleImport = () => {
    const existingDiagram = diagrams[diagram.id];
    const now = new Date().toISOString();
    let importedDiagram: Diagram;

    if (!existingDiagram) {
      importedDiagram = {
        ...diagram,
        updatedAt: now,
      };
    } else {
      const importDate = new Date().toLocaleDateString(i18n.language || undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });

      importedDiagram = {
        ...diagram,
        id: generateId("d"),
        name: `${diagram.name} ${t("share.importedSuffix", { date: importDate })}`,
        updatedAt: now,
      };
    }

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
      <EmbedCanvas
        diagram={diagram}
        offsetTop={44}
        showOpenInStructuraButton={false}
      />
    </div>
  );
};

export default SharedDiagramView;
