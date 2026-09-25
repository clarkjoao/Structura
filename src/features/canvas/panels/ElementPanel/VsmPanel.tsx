import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  resolveVersionSnapshot,
  useActiveDiagram,
  useDiagramActions,
  type ComponentPatch,
  type SkinParts,
} from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import type { ElementInspectorProps } from "@/features/elements/element.types";
import { useEffectiveDefaultAccent } from "@/features/canvas/nodes/useEffectiveDefaultAccent";
import Field from "./components/Field";
import { FlowAppearanceSection, PositionSection } from "./sections";
import { VsmFieldsSection } from "./sections/VsmFieldsSection";

/**
 * The inspector for every Value Stream Mapping element: name and description,
 * the fields that element carries (`VsmFieldsSection`), and the flow skin's
 * Appearance section with the element's own default accent.
 */
export default function VsmPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
}: ElementInspectorProps) {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [name, setName] = useState(component.name);
  const [desc, setDesc] = useState(component.description);
  const activeDiagram = useActiveDiagram();
  const { updateNodeLayout } = useDiagramActions();
  const resolved = useMemo(
    () =>
      activeDiagram
        ? resolveVersionSnapshot(activeDiagram, activeDiagram.activeVersionId ?? null)
        : null,
    [activeDiagram],
  );
  const descriptor = getElement(component.type);
  // Unset, the accent is the lane's (when it passes one on) or the element's.
  const defaultAccent = useEffectiveDefaultAccent(component);
  const update = (patch: ComponentPatch) => updateComponent(component.id, patch);

  useEffect(() => {
    setName(component.name);
    setDesc(component.description);
  }, [component.id, component.name, component.description]);

  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [focusTitleTrigger]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold truncate">
          {descriptor ? t(descriptor.labelKey) : component.type}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PositionSection
          componentId={component.id}
          nodeLayout={resolved?.nodeLayouts[component.id]}
          updateNodeLayout={updateNodeLayout}
          isPanel
        />
        <Field
          label={t("common.name")}
          value={name}
          inputRef={titleInputRef}
          onChange={(value) => {
            setName(value);
            update({ name: value });
          }}
        />
        <Field
          label={t("common.description")}
          value={desc}
          multiline
          onChange={(value) => {
            setDesc(value);
            update({ description: value });
          }}
        />
        <VsmFieldsSection component={component} onChange={update} />
        {descriptor?.skin && (
          <FlowAppearanceSection
            appearance={component as SkinParts}
            defaultAccent={defaultAccent}
            onChange={update}
          />
        )}
      </div>

      <div className="p-3 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => {
            removeComponent(component.id);
            onClose();
          }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
