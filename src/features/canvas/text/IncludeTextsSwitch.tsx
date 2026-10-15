import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import {
  isTextComponent,
  useActiveDiagramId,
  useDiagramActions,
  useDiagramStore,
} from "@/features/diagram";

/**
 * Whether the active diagram's texts go out with it: into a link, an embed, a
 * viewer, a draw.io file. Off by default — the planning texts are the author's
 * until they choose to include them. It sets the diagram's saved `textsVisible`
 * and is independent of the editor's own text layer.
 *
 * Shown only when the diagram has a text, so it never asks about nothing.
 */
export function IncludeTextsSwitch() {
  const { t } = useTranslation();
  const id = useId();
  const diagramId = useActiveDiagramId();
  const { setTextsVisible } = useDiagramActions();
  const hasTexts = useDiagramStore((state) =>
    state.activeDiagramId
      ? Object.values(state.diagrams[state.activeDiagramId]?.snapshot.components ?? {}).some(
          isTextComponent,
        )
      : false,
  );
  const included = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId]?.textsVisible === true : false,
  );

  if (!diagramId || !hasTexts) return null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {t("textLayer.includeTexts")}
        </label>
        <p className="text-xs text-muted-foreground">{t("textLayer.includeTextsHint")}</p>
      </div>
      <Switch
        id={id}
        checked={included}
        onCheckedChange={(checked) => setTextsVisible(diagramId, checked)}
      />
    </div>
  );
}
