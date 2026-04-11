import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Editor from "@monaco-editor/react";
import { Braces, Check, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDiagramActions } from "@/features/diagram";
import { useTheme } from "@/hooks/useTheme";
import { CompareSceneBadges, SceneElementBadge } from "../SceneElementBadge";
import { singleIncomingTargetHandleId } from "../../edges/connectionDerivations";
import type { JsonViewerNodeData, JsonViewerMode } from "./JsonViewerNode.types";

const COLLAPSED_W = 240;
const COLLAPSED_H = 88;
const EXPANDED_MIN_W = 320;
const EXPANDED_MIN_H = 260;
const PREVIEW_LINES = 3;

const jsonViewerIncomingHandleClassName =
  "!border-background transition-all duration-150 !w-2.5 !h-2.5 !bg-muted-foreground";

function JsonViewerIncomingHandle({ elementId }: { elementId: string }) {
  return (
    <Handle
      id={singleIncomingTargetHandleId(elementId)}
      type="target"
      position={Position.Left}
      className={jsonViewerIncomingHandleClassName}
    />
  );
}

function buildPreview(raw: string, lines: number): string {
  try {
    const formatted = JSON.stringify(JSON.parse(raw), null, 2);
    return `${formatted.split("\n").slice(0, lines).join("\n")}\n…`;
  } catch {
    const slice = raw.slice(0, 120);
    return raw.length > 120 ? `${slice}…` : slice;
  }
}

function isValidJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

const JsonViewerNode = memo(({ data, selected }: NodeProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const diagramNodeData = data as unknown as JsonViewerNodeData;
  const onInlineEditingChange = diagramNodeData.onInlineEditingChange;
  const { updateComponent, updateNodeLayout } = useDiagramActions();
  const { getNode } = useReactFlow();

  const isActive = selected || diagramNodeData.isSelected;
  const [mode, setMode] = useState<JsonViewerMode>("collapsed");
  const [draft, setDraft] = useState(diagramNodeData.jsonContent ?? "{}");
  const [parseError, setParseError] = useState(false);
  const lastExpandedSizeRef = useRef<{ width: number; height: number } | null>(null);

  const isExpanded = mode === "expanded" || mode === "editing";
  const isEditing = mode === "editing";

  useEffect(() => {
    if (!isEditing) {
      setDraft(diagramNodeData.jsonContent ?? "{}");
    }
  }, [diagramNodeData.jsonContent, isEditing]);

  const expandToEditingLayout = useCallback(() => {
    const node = getNode(diagramNodeData.elementId);
    if (!node) return;
    const position = { x: node.position.x, y: node.position.y };
    const restored = lastExpandedSizeRef.current;
    const layoutWidth = diagramNodeData.layoutWidth;
    const layoutHeight = diagramNodeData.layoutHeight;
    const width = restored
      ? Math.max(restored.width, EXPANDED_MIN_W)
      : Math.max(layoutWidth, EXPANDED_MIN_W);
    const height = restored
      ? Math.max(restored.height, EXPANDED_MIN_H)
      : Math.max(layoutHeight, EXPANDED_MIN_H);
    updateNodeLayout(diagramNodeData.elementId, position, { width, height });
  }, [
    diagramNodeData.elementId,
    diagramNodeData.layoutWidth,
    diagramNodeData.layoutHeight,
    getNode,
    updateNodeLayout,
  ]);

  const handleStartEdit = useCallback(() => {
    if (mode === "collapsed") {
      expandToEditingLayout();
    }
    setDraft(diagramNodeData.jsonContent ?? "{}");
    setParseError(false);
    onInlineEditingChange?.(true);
    setMode("editing");
  }, [
    mode,
    expandToEditingLayout,
    diagramNodeData.jsonContent,
    onInlineEditingChange,
  ]);

  useLayoutEffect(() => {
    diagramNodeData.onStartEdit = handleStartEdit;
  }, [diagramNodeData, handleStartEdit]);

  const handleToggleExpand = useCallback(() => {
    const node = getNode(diagramNodeData.elementId);
    if (!node) return;

    const position = { x: node.position.x, y: node.position.y };

    if (mode === "collapsed") {
      const restored = lastExpandedSizeRef.current;
      const layoutWidth = diagramNodeData.layoutWidth;
      const layoutHeight = diagramNodeData.layoutHeight;
      const width = restored
        ? Math.max(restored.width, EXPANDED_MIN_W)
        : Math.max(layoutWidth, EXPANDED_MIN_W);
      const height = restored
        ? Math.max(restored.height, EXPANDED_MIN_H)
        : Math.max(layoutHeight, EXPANDED_MIN_H);
      updateNodeLayout(diagramNodeData.elementId, position, { width, height });
      setMode("expanded");
      return;
    }

    if (isEditing) {
      setDraft(diagramNodeData.jsonContent ?? "{}");
      setParseError(false);
      onInlineEditingChange?.(false);
    }

    const measuredWidth = node.measured?.width ?? diagramNodeData.layoutWidth;
    const measuredHeight = node.measured?.height ?? diagramNodeData.layoutHeight;
    if (measuredWidth > COLLAPSED_W + 1 || measuredHeight > COLLAPSED_H + 1) {
      lastExpandedSizeRef.current = {
        width: Math.max(measuredWidth, EXPANDED_MIN_W),
        height: Math.max(measuredHeight, EXPANDED_MIN_H),
      };
    }

    updateNodeLayout(diagramNodeData.elementId, position, {
      width: COLLAPSED_W,
      height: COLLAPSED_H,
    });
    setMode("collapsed");
    setParseError(false);
  }, [
    mode,
    isEditing,
    diagramNodeData.elementId,
    diagramNodeData.jsonContent,
    diagramNodeData.layoutWidth,
    diagramNodeData.layoutHeight,
    getNode,
    onInlineEditingChange,
    updateNodeLayout,
  ]);

  const handleCommit = useCallback(() => {
    if (!isValidJson(draft)) {
      setParseError(true);
      return;
    }
    setParseError(false);
    updateComponent(diagramNodeData.elementId, { jsonContent: draft });
    onInlineEditingChange?.(false);
    setMode("expanded");
  }, [draft, diagramNodeData.elementId, onInlineEditingChange, updateComponent]);

  const handleCancelEdit = useCallback(() => {
    setDraft(diagramNodeData.jsonContent ?? "{}");
    setParseError(false);
    onInlineEditingChange?.(false);
    setMode("expanded");
  }, [diagramNodeData.jsonContent, onInlineEditingChange]);

  const preview = buildPreview(diagramNodeData.jsonContent ?? "{}", PREVIEW_LINES);
  const editorTheme = theme === "dark" ? "vs-dark" : "light";

  return (
    <>
      <JsonViewerIncomingHandle elementId={diagramNodeData.elementId} />

      <NodeResizer
        minWidth={EXPANDED_MIN_W}
        minHeight={EXPANDED_MIN_H}
        isVisible={isActive && isExpanded}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />

      <div
        aria-label={t("jsonViewer.ariaLabel", { name: diagramNodeData.name })}
        className={cn(
          "flex flex-col overflow-hidden rounded-md border",
          "bg-card text-card-foreground transition-shadow duration-200",
          isActive
            ? "border-primary ring-2 ring-primary/30 shadow-lg"
            : "border-border shadow-md hover:shadow-lg",
        )}
        style={
          isExpanded
            ? { width: "100%", height: "100%" }
            : { width: COLLAPSED_W, height: COLLAPSED_H }
        }
      >
        {diagramNodeData.compareBadges && (
          <CompareSceneBadges
            a={diagramNodeData.compareBadges.a}
            b={diagramNodeData.compareBadges.b}
          />
        )}
        {!diagramNodeData.compareBadges && diagramNodeData.sceneBadge && (
          <SceneElementBadge
            name={diagramNodeData.sceneBadge.name}
            color={diagramNodeData.sceneBadge.color}
          />
        )}

        <div
          className={cn(
            "drag-handle flex items-center gap-2 px-3 bg-muted/60 border-b border-border shrink-0",
            isExpanded ? "cursor-grab active:cursor-grabbing h-9" : "h-8",
          )}
        >
          <Braces className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs font-semibold truncate flex-1">
            {diagramNodeData.name || t("jsonViewer.unnamed")}
          </span>
          {diagramNodeData.schemaRef && (
            <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[80px]">
              {diagramNodeData.schemaRef}
            </span>
          )}

          {isExpanded && !isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground nodrag"
              aria-label={t("jsonViewer.edit")}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleCommit}
                className="p-1 rounded hover:bg-accent text-green-500 hover:text-green-400 nodrag"
                aria-label={t("jsonViewer.confirm")}
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground nodrag"
                aria-label={t("common.cancel")}
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleToggleExpand}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground nodrag"
            aria-label={isExpanded ? t("jsonViewer.collapse") : t("jsonViewer.expand")}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {!isExpanded ? (
          <div className="flex-1 px-3 py-2 overflow-hidden min-h-0">
            <pre className="text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all line-clamp-3">
              {preview}
            </pre>
          </div>
        ) : (
          <div className="flex-1 min-h-0 relative nodrag nowheel">
            {parseError && (
              <div className="absolute top-0 left-0 right-0 z-10 bg-destructive/10 border-b border-destructive/30 px-3 py-1 text-[11px] text-destructive">
                {t("jsonViewer.invalidJson")}
              </div>
            )}
            <Editor
              height="100%"
              language="json"
              theme={editorTheme}
              value={isEditing ? draft : diagramNodeData.jsonContent ?? "{}"}
              onChange={(value) => {
                if (isEditing) setDraft(value ?? "");
              }}
              options={{
                readOnly: !isEditing,
                minimap: { enabled: false },
                fontSize: 11,
                lineNumbers: "off",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                folding: true,
                renderLineHighlight: isEditing ? "line" : "none",
                scrollbar: { vertical: "auto", horizontal: "hidden" },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                contextmenu: false,
              }}
              onMount={(editor) => {
                editor.getDomNode()?.addEventListener("keydown", (keyboardEvent) => {
                  keyboardEvent.stopPropagation();
                });
              }}
            />
          </div>
        )}
      </div>
    </>
  );
});

JsonViewerNode.displayName = "JsonViewerNode";

export default JsonViewerNode;
