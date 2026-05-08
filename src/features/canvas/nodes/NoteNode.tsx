import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useComponentIcon, useDiagramActions } from "@/features/diagram";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { KEY, keyIs } from "@/lib/keyboard-utils";

import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";
import { singleIncomingTargetHandleId } from "../edges/connectionDerivations";

const DEFAULT_PAPER_COLOR = "hsl(45 25% 97%)"; 

const noteIncomingHandleClassName =
  "!border-background transition-all duration-150 !w-2.5 !h-2.5 !bg-muted-foreground";

function NoteIncomingHandle({ elementId }: { elementId: string }) {
  return (
    <Handle
      id={singleIncomingTargetHandleId(elementId)}
      type="target"
      position={Position.Left}
      className={noteIncomingHandleClassName}
    />
  );
}

export interface NoteNodeData {
  elementId: string;
  name: string;
  description: string;
  panelColor?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  onStartEdit?: () => void;
  
  onClickBody?: () => void;
  onInlineEditingChange?: (editing: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
}

function isDarkBg(color: string): boolean {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 140;
  }
  const match = color.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (match) {
    return parseFloat(match[3]) < 45;
  }
  return false;
}

const NoteNode = memo(({ data, selected }: NodeProps) => {
  const { t } = useTranslation();
  const d = data as unknown as NoteNodeData;
  const elementId = d.elementId;
  const description = d.description;
  const onInlineEditingChange = d.onInlineEditingChange;
  const collapsed = d.collapsed ?? false;
  const onToggleCollapse = d.onToggleCollapse;
  const customDiagramIcon = useComponentIcon(elementId);
  const { highlightedNodeIds } = useHandleHighlight();
  const { updateComponent } = useDiagramActions();

  const paperColor = d.panelColor || DEFAULT_PAPER_COLOR;
  const isSelected = selected || d.isSelected;
  const isHighlighted =
    (d.isHighlighted ?? false) || highlightedNodeIds.has(elementId);
  const isActive = isSelected || isHighlighted;
  const dark = isDarkBg(paperColor);
  const collabHighlight = useCollabHighlight(elementId);
  const textClass = dark ? "text-white" : "text-foreground";
  const mutedClass = dark ? "text-white/60" : "text-muted-foreground";

  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipCommitOnBlurRef = useRef(false);

  const handleStartEdit = useCallback(() => {
    if (collapsed) {
      onToggleCollapse?.();
      return;
    }
    setDraftValue(description ?? "");
    onInlineEditingChange?.(true);
    setIsEditing(true);
  }, [collapsed, description, onInlineEditingChange, onToggleCollapse]);

  useEffect(() => {
    if (!collapsed || !isEditing) return;
    skipCommitOnBlurRef.current = true;
    onInlineEditingChange?.(false);
    setIsEditing(false);
    setDraftValue("");
  }, [collapsed, isEditing, onInlineEditingChange]);

  useEffect(() => {
    d.onStartEdit = handleStartEdit;
    d.onClickBody = handleStartEdit;
  }, [d, handleStartEdit]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  const handleCommit = useCallback(() => {
    if (skipCommitOnBlurRef.current) {
      skipCommitOnBlurRef.current = false;
      return;
    }
    if (!isEditing) return;
    setIsEditing(false);
    onInlineEditingChange?.(false);
    if (draftValue !== description) {
      updateComponent(elementId, { description: draftValue });
    }
  }, [
    isEditing,
    draftValue,
    description,
    elementId,
    onInlineEditingChange,
    updateComponent,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (keyIs(e, KEY.ESCAPE)) {
        skipCommitOnBlurRef.current = true;
        onInlineEditingChange?.(false);
        setIsEditing(false);
        setDraftValue("");
      }
      e.stopPropagation();
    },
    [onInlineEditingChange],
  );

  const content = description?.trim() ?? "";
  const title = d.name?.trim() ?? "";
  const hasContent = content.length > 0;
  const descriptionPreview = content.replace(/\s+/g, " ").slice(0, 120);

  const selectedRing =
    "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]";
  const unselectedNoteShadow = "shadow-md hover:shadow-lg";

  if (collapsed) {
    return (
      <div
        aria-label={title ? t("noteNode.ariaWithTitle", { title }) : t("noteNode.ariaDefault")}
        className={`relative w-full h-full rounded-lg flex items-center gap-2 px-3 transition-all duration-200 overflow-hidden ${
          isActive ? selectedRing : unselectedNoteShadow
        } ${dark ? "border-2 border-white/25" : "border-2 border-border/60"}`}
        style={{
          backgroundColor: paperColor,
          boxShadow: isActive
            ? undefined
            : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <NoteIncomingHandle elementId={elementId} />
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {d.compareBadges && (
          <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />
        )}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        {customDiagramIcon ? (
          <CustomIconRenderer
            icon={customDiagramIcon}
            size={24}
            className={`shrink-0 ${mutedClass}`}
          />
        ) : (
          <FileText
            className={`h-4 w-4 shrink-0 ${mutedClass}`}
            strokeWidth={1.5}
          />
        )}
        <div className="min-w-0 flex-1">
          <span className={`text-sm font-semibold truncate block ${textClass}`}>
            {title || t("noteNode.titleFallback")}
          </span>
          {hasContent && (
            <span className={`text-[11px] truncate block ${mutedClass}`}>
              {descriptionPreview}
            </span>
          )}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={t("noteNode.expandAria")}
            aria-expanded={false}
            className={`shrink-0 p-1 rounded hover:bg-black/10 ${mutedClass} hover:opacity-100`}
            title={t("noteNode.expandTitle")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={isSelected && !isEditing}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <div
        aria-label={title ? t("noteNode.ariaWithTitle", { title }) : t("noteNode.ariaDefault")}
        className={`relative flex flex-col w-full h-full overflow-hidden transition-shadow duration-200 ${
          isActive ? selectedRing : unselectedNoteShadow
        }`}
        style={{
          backgroundColor: paperColor,
          boxShadow: isActive
            ? undefined
            : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <NoteIncomingHandle elementId={elementId} />
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {d.compareBadges && (
          <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />
        )}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}

        <div
          className={`flex items-center gap-2 px-5 py-2.5 border-b ${dark ? "border-white/20" : "border-border/60"}`}
          style={{ minHeight: 36 }}
        >
          {customDiagramIcon ? (
            <CustomIconRenderer
              icon={customDiagramIcon}
              size={24}
              className={`shrink-0 ${mutedClass}`}
            />
          ) : (
            <FileText
              className={`h-4 w-4 shrink-0 ${mutedClass}`}
              strokeWidth={1.5}
            />
          )}
          <span className={`text-xs font-medium truncate flex-1 ${mutedClass}`}>
            {title || t("noteNode.titleFallback")}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              aria-label={t("noteNode.collapseAria")}
              aria-expanded={true}
              className={`shrink-0 p-1 rounded hover:bg-black/10 ${mutedClass} hover:opacity-100`}
              title={t("noteNode.collapseTitle")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-hidden"
          onClick={(e) => {
            if (isEditing) return;
            e.stopPropagation();
            handleStartEdit();
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              className={`w-full h-full resize-none border-none outline-none bg-transparent px-5 py-4 text-[13px] leading-relaxed font-mono ${textClass}`}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
              placeholder={t("noteNode.emptyHint")}
            />
          ) : (
            <div
              className={`flex-1 overflow-auto px-5 py-4 h-full ${textClass}`}
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {hasContent ? (
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0 text-[13px] leading-relaxed">
                          {children}
                        </p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-base font-semibold mt-3 mb-1 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-sm font-semibold mt-2 mb-1 first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-medium mt-2 mb-0.5 first:mt-0">
                          {children}
                        </h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 mb-2 space-y-0.5 text-[13px]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-[13px]">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                      ),
                      code: ({ children }) => (
                        <code className="px-1 py-0.5 rounded bg-foreground/10 text-[12px] font-mono">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="p-2 rounded-md bg-foreground/10 text-[12px] overflow-x-auto mb-2">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-foreground/30 pl-3 my-2 italic text-[13px]">
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className={`text-sm italic px-5 py-4 ${mutedClass}`}>
                  {t("noteNode.emptyHint")}
                </p>
              )}
            </div>
          )}
        </div>

        <div
          className={`h-2 shrink-0 ${dark ? "bg-white/5" : "bg-foreground/[0.02]"}`}
        />
      </div>
    </>
  );
});

NoteNode.displayName = "NoteNode";

export default NoteNode;
