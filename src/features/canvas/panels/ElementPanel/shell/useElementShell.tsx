import { Box, Copy, Lock, LockOpen, Trash2, Fingerprint } from "lucide-react";
import { createElement, useMemo, type ReactNode } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useActiveDiagram, useDiagramActions, useResolvedComponents } from "@/features/diagram";
import type { Component } from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { duplicateSelection } from "@/features/canvas/utils/duplicateSelection";
import type { PanelMenuItem, PanelTrailItem } from "./PanelHeader";

/** How many ancestors the header trail names. */
const TRAIL_DEPTH = 2;

/** The element's icon and type label, from the registry. */
export function useElementIdentity(component: Component): { icon: ReactNode; typeLabel: string } {
  const { t } = useTranslation();
  const descriptor = getElement(component.type);
  const paletteIcon = descriptor?.palette.icon;
  const icon =
    paletteIcon?.kind === "lucide"
      ? createElement(paletteIcon.icon, { className: "h-3.5 w-3.5" })
      : createElement(Box, { className: "h-3.5 w-3.5" });
  return { icon, typeLabel: descriptor ? t(descriptor.labelKey) : component.type };
}

/** The element's ancestors, nearest first, for the header trail. */
export function useElementTrail(component: Component): PanelTrailItem[] {
  const components = useResolvedComponents();
  return useMemo(() => {
    const trail: PanelTrailItem[] = [];
    let parentId = component.parentId;
    while (parentId && trail.length < TRAIL_DEPTH) {
      const parent = components[parentId];
      if (!parent) break;
      trail.push({ id: parent.id, name: parent.name });
      parentId = parent.parentId;
    }
    return trail;
  }, [components, component.parentId]);
}

/** The ⋯ menu of one element: duplicate, lock, copy ID, delete. */
export function useElementMenu(
  component: Component,
  removeElement: () => void,
  updateComponent: (id: string, patch: { locked?: boolean }) => void,
): PanelMenuItem[] {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const reactFlow = useReactFlow();
  const { copyToClipboard, pasteFromClipboard } = useDiagramActions();
  const setSelectedNodeIds = useCanvasSelectionStore((state) => state.setSelectedNodeIds);

  const duplicate = () => {
    if (!diagram) return;
    const nodes = reactFlow.getNodes().filter((node) => node.id === component.id);
    const newIds = duplicateSelection({ diagram, nodes, copyToClipboard, pasteFromClipboard });
    if (newIds.length === 0) return;
    reactFlow.setNodes((previous) =>
      previous.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
    );
    setSelectedNodeIds(new Set(newIds));
  };

  const locked = component.locked === true;
  return [
    { key: "duplicate", label: t("panelShell.duplicate"), icon: Copy, onSelect: duplicate },
    {
      key: "lock",
      label: locked ? t("panelShell.unlock") : t("panelShell.lock"),
      icon: locked ? LockOpen : Lock,
      onSelect: () => updateComponent(component.id, { locked: !locked }),
    },
    {
      key: "copy-id",
      label: t("panelShell.copyId"),
      icon: Fingerprint,
      onSelect: () => {
        void navigator.clipboard?.writeText(component.id);
        toast.success(t("panelShell.idCopied"));
      },
    },
    {
      key: "delete",
      label: t("elementPanel.remove"),
      icon: Trash2,
      onSelect: removeElement,
      destructive: true,
      separated: true,
    },
  ];
}
