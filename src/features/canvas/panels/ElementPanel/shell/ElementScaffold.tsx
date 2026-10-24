import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  resolveVersionSnapshot,
  useActiveDiagramModel,
  useDiagramActions,
} from "@/features/diagram";
import type { Component, ComponentPatch } from "@/features/diagram";
import { useElementTextLock } from "@/features/collaboration/hooks/useElementLocks";
import { PositionSection } from "../sections/PositionSection";
import { AdvancedFooter } from "./AdvancedFooter";
import { PanelHeader } from "./PanelHeader";
import { useElementIdentity, useElementMenu, useElementTrail } from "./useElementShell";

export interface ElementScaffoldProps {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  onFocusElement?: (componentId: string) => void;
  focusTitleTrigger?: number;
  /** The header name. Omitted, it is read from `component.name`. */
  name?: string;
  /** What committing the header name writes. Omitted, `{ name }`. */
  nameToPatch?: (name: string) => ComponentPatch;
  /** The header name is shown but not editable here. */
  nameReadOnly?: boolean;
  namePlaceholder?: string;
  /** Show X/Y (and W/H when `sizable`) under Advanced. Default true. */
  showPosition?: boolean;
  sizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  /** Plugin slot or any block rendered after the body, above the footer. */
  afterBody?: ReactNode;
  children: ReactNode;
}

/**
 * Frame of every registered element panel: the shared header, a scrolling body, and the
 * Advanced footer. A panel supplies its own sections as `children`.
 */
export function ElementScaffold({
  component,
  onClose,
  updateComponent,
  removeComponent,
  onFocusElement,
  focusTitleTrigger = 0,
  name,
  nameToPatch,
  nameReadOnly = false,
  namePlaceholder,
  showPosition = true,
  sizable = false,
  minWidth,
  minHeight,
  maxWidth,
  afterBody,
  children,
}: ElementScaffoldProps) {
  const { t } = useTranslation();
  const diagram = useActiveDiagramModel();
  const { updateNodeLayout, setNodeZIndex } = useDiagramActions();
  const nodeLayout = useMemo(
    () =>
      diagram
        ? resolveVersionSnapshot(diagram, diagram.activeVersionId ?? null).nodeLayouts[component.id]
        : undefined,
    [diagram, component.id],
  );
  const identity = useElementIdentity(component);
  const trail = useElementTrail(component);
  const textLock = useElementTextLock(component.id);
  const menu = useElementMenu(
    component,
    () => {
      removeComponent(component.id);
      onClose();
    },
    updateComponent,
  );
  const titleRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null> = useRef(null);
  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      });
    }
  }, [focusTitleTrigger]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        icon={identity.icon}
        typeLabel={identity.typeLabel}
        name={name ?? component.name}
        namePlaceholder={namePlaceholder ?? t("common.unnamedElement")}
        onCommitName={
          nameReadOnly
            ? undefined
            : (value) => updateComponent(component.id, nameToPatch?.(value) ?? { name: value })
        }
        nameInputRef={titleRef}
        textLock={textLock}
        trail={trail}
        onSelectElement={onFocusElement}
        menu={menu}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {afterBody}
      <AdvancedFooter
        id={component.id}
        zIndex={nodeLayout?.zIndex}
        onCommitZIndex={nodeLayout ? (z) => setNodeZIndex(component.id, z) : undefined}
      >
        {showPosition && (
          <PositionSection
            componentId={component.id}
            nodeLayout={nodeLayout}
            updateNodeLayout={updateNodeLayout}
            isPanel={sizable}
            minWidth={minWidth}
            minHeight={minHeight}
            maxWidth={maxWidth}
          />
        )}
      </AdvancedFooter>
    </div>
  );
}
