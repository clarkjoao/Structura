import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { FileText } from "lucide-react";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";

import { NOTE_DEFAULT_W, NOTE_DEFAULT_H } from "../constants";
import { useTranslation } from "react-i18next";
import { SceneElementBadge } from "./SceneElementBadge";

const DEFAULT_PAPER_COLOR = "hsl(45 25% 97%)"; // papel ofuscado

export interface NoteNodeData {
  elementId: string;
  name: string;
  description: string;
  panelColor?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  sceneBadge?: { name: string; color: string };
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
  const { highlightedNodeIds } = useHandleHighlight();
  const paperColor = d.panelColor || DEFAULT_PAPER_COLOR;
  const isSelected = selected || d.isSelected;
  const isHighlighted =
    (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const dark = isDarkBg(paperColor);
  const textClass = dark ? "text-white" : "text-foreground";
  const mutedClass = dark ? "text-white/60" : "text-muted-foreground";

  const content = d.description?.trim() ?? "";
  const title = d.name?.trim() ?? "";
  const hasContent = content.length > 0;

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <div
        aria-label={title ? t("noteNode.ariaWithTitle", { title }) : t("noteNode.ariaDefault")}
        className={`relative flex flex-col w-full h-full overflow-hidden transition-shadow duration-200 ${
          isActive
            ? "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
            : "shadow-md hover:shadow-lg"
        }`}
        style={{
          backgroundColor: paperColor,
          boxShadow: isActive
            ? undefined
            : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        {/* Margem superior — cabeçalho tipo folha A3 */}
        <div
          className={`flex items-center gap-2 px-5 py-2.5 border-b ${dark ? "border-white/20" : "border-border/60"}`}
          style={{ minHeight: 36 }}
        >
          <FileText
            className={`h-4 w-4 shrink-0 ${mutedClass}`}
            strokeWidth={1.5}
          />
          <span
            className={`text-xs font-medium truncate flex-1 ${mutedClass}`}
          >
            {title || t("noteNode.titleFallback")}
          </span>
        </div>

        {/* Área de conteúdo — corpo da folha */}
        <div
          className={`flex-1 overflow-auto px-5 py-4 min-h-0 ${textClass}`}
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
            <p className={`text-sm italic ${mutedClass}`}>
              {t("noteNode.emptyHint")}
            </p>
          )}
        </div>

        {/* Rodapé sutil — margem inferior */}
        <div
          className={`h-2 shrink-0 ${dark ? "bg-white/5" : "bg-foreground/[0.02]"}`}
        />
      </div>
    </>
  );
});

NoteNode.displayName = "NoteNode";

export default NoteNode;
