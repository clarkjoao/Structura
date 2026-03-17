import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Square, FileText, MessageSquare, Table2, Globe, Cloud, Box } from "lucide-react";
import type { Component } from "@/features/diagram";
import { isAwsType } from "@/lib/catalogs/aws";
import { TypeConfig } from "@/features/canvas/nodes/CustomNode/TypeConfig";

interface CanvasSearchProps {
  onClose: () => void;
  onSelectResult: (componentId: string) => void;
  components: Record<string, Component>;
}

export default function CanvasSearch({ onClose, onSelectResult, components }: CanvasSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(components)
      .filter((c) => {
        const name = c.name?.toLowerCase() ?? "";
        const desc = c.description?.toLowerCase() ?? "";
        const tech = "technology" in c ? ((c as unknown as { technology?: string }).technology?.toLowerCase() ?? "") : "";
        const tags = (c.tags ?? []).map((t) => t.toLowerCase());
        return (
          name.includes(q) ||
          desc.includes(q) ||
          (tech ? tech.includes(q) : false) ||
          tags.some((t) => t.includes(q))
        );
      })
      .slice(0, 12);
  }, [query, components]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(Math.max(i, 0), Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onSelectResult(results[selectedIndex].id);
    }
  }

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[480px]" ref={containerRef}>
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar componente..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((comp, i) => (
              <button
                key={comp.id}
                onClick={() => onSelectResult(comp.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover text-foreground"
                }`}
              >
                <ComponentTypeIcon
                  type={comp.type}
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <HighlightMatch text={comp.name} query={query} />
                  </p>
                  {comp.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{comp.description}</p>
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0 font-mono">
                  {comp.type}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum resultado para &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>
              <kbd className="border border-border rounded px-1">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="border border-border rounded px-1">Enter</kbd> ir para
            </span>
            <span>
              <kbd className="border border-border rounded px-1">Esc</kbd> fechar
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm font-semibold">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function ComponentTypeIcon({ type, className }: { type: string; className?: string }) {
  const cfg = TypeConfig[type];
  if (cfg) {
    const Icon = cfg.icon;
    return <Icon className={className} />;
  }
  if (type === "panel") return <Square className={className} />;
  if (type === "note") return <FileText className={className} />;
  if (type === "callout") return <MessageSquare className={className} />;
  if (type === "table") return <Table2 className={className} />;
  if (type === "api-group") return <Globe className={className} />;
  if (isAwsType(type)) return <Cloud className={className} />;
  return <Box className={className} />;
}

