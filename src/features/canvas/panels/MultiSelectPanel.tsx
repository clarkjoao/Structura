import { useMemo } from "react";
import { X, LayoutDashboard, Copy, Trash2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import {
  useActiveDiagram,
  useDiagramActions,
} from "@/features/diagram";
import type { ComponentType } from "@/features/diagram";
import { isPanelType } from "@/features/diagram";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  person: "person",
  system: "system",
  container: "container",
  component: "component",
  panel: "panel",
  note: "nota",
};

interface MultiSelectPanelProps {
  selectedNodes: Node[];
  onClose: () => void;
}

export function MultiSelectPanel({ selectedNodes, onClose }: MultiSelectPanelProps) {
  const diagram = useActiveDiagram();
  const {
    groupNodes,
    removeComponent,
    addComponent,
    updateComponent,
  } = useDiagramActions();

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const components = useMemo(
    () =>
      diagram
        ? ids.map((id) => diagram.snapshot.components[id]).filter(Boolean)
        : [],
    [diagram, ids],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedNodes.forEach((n) => {
      const t = (n.data?.type as string) ?? "component";
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return counts;
  }, [selectedNodes]);

  const typeSummary = useMemo(
    () =>
      Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${TYPE_LABELS[type] ?? type}${count > 1 ? "s" : ""}`)
        .join(", "),
    [typeCounts],
  );

  const allSameType = useMemo(() => {
    if (selectedNodes.length <= 1) return true;
    const first = (selectedNodes[0].data?.type as ComponentType) ?? "component";
    return selectedNodes.every(
      (n) => ((n.data?.type as ComponentType) ?? "component") === first,
    );
  }, [selectedNodes]);

  const sharedTechnology = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = ("technology" in components[0] ? (components[0] as any).technology : undefined) ?? "";
    const allSame = components.every((c) => (("technology" in c ? (c as any).technology : undefined) ?? "") === first);
    return allSame ? first : null;
  }, [components]);

  const sharedDescription = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = components[0].description ?? "";
    const allSame = components.every((c) => (c.description ?? "") === first);
    return allSame ? first : null;
  }, [components]);

  const sharedTags = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = components[0].tags?.join(", ") ?? "";
    const allSame = components.every(
      (c) => (c.tags?.join(", ") ?? "") === first,
    );
    return allSame ? first : null;
  }, [components]);

  const handleGroup = () => {
    const panelId = groupNodes(ids);
    if (panelId) onClose();
  };

  const handleDuplicate = () => {
    if (!diagram) return;
    ids.forEach((id, index) => {
      const comp = diagram.snapshot.components[id];
      if (!comp || isPanelType(comp.type)) return;
      const layout = diagram.nodeLayouts[id];
      addComponent(
        comp.type,
        `${comp.name} (cópia)`,
        comp.parentId,
        {
          x: (layout?.x ?? 0) + 30 * (index + 1),
          y: (layout?.y ?? 0) + 30 * (index + 1),
        },
        ("awsService" in comp) ? (comp as any).awsService : undefined,
      );
    });
    onClose();
  };

  const handleDelete = () => {
    ids.forEach((id) => removeComponent(id));
    onClose();
  };

  const handleTechnologyChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { technology: value || undefined }));
  };

  const handleDescriptionChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { description: value }));
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      ? value.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    ids.forEach((id) => updateComponent(id, { tags }));
  };

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Seleção múltipla
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">
          {selectedNodes.length} elemento{selectedNodes.length !== 1 ? "s" : ""} selecionado
          {selectedNodes.length !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{typeSummary}</p>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Ações
        </p>
        <div className="flex flex-col gap-2">
          {ids.length >= 2 && (
            <button
              type="button"
              onClick={handleGroup}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Agrupar
            </button>
          )}
          <button
            type="button"
            onClick={handleDuplicate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Deletar
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Propriedades comuns
        </p>
        <p className="text-[10px] text-muted-foreground italic">
          (editar aplica a todos)
        </p>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            Tags
          </label>
          <input
            value={sharedTags !== null ? sharedTags : ""}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder={sharedTags === null ? "Múltiplos valores" : "Tags separadas por vírgula"}
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm",
              sharedTags === null && "italic text-muted-foreground",
            )}
          />
        </div>

        {allSameType && (
          <>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                Tecnologia
              </label>
              <input
                value={sharedTechnology ?? ""}
                onChange={(e) => handleTechnologyChange(e.target.value)}
                placeholder={sharedTechnology === null ? "Múltiplos valores" : "ex.: REST, gRPC"}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm",
                  sharedTechnology === null && "italic text-muted-foreground",
                )}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                Descrição
              </label>
              <textarea
                value={sharedDescription ?? ""}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder={sharedDescription === null ? "Múltiplos valores" : "Descrição"}
                rows={2}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm resize-none",
                  sharedDescription === null && "italic text-muted-foreground",
                )}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
