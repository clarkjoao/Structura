import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, ArrowRight, Layers } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import {
  PATTERNS,
  PATTERNS_BY_CATEGORY,
  PATTERN_CATEGORIES,
  type PatternCategory,
  type PatternTemplate,
} from "@/lib/catalogs/patterns";
import { useDiagramActions } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { useTranslation } from "react-i18next";

const CATEGORIES = PATTERN_CATEGORIES;

const CATEGORY_ICONS: Record<PatternCategory, string> = {
  messaging: "📨",
  api: "🔌",
  resilience: "🛡️",
  data: "🗄️",
  "event-driven": "⚡",
  security: "🔐",
};

interface PatternPickerProps {
  onClose: () => void;
  onBeforeInsert?: () => void;
}

/** Mini flow diagram preview */
const PatternFlowPreview = ({ pattern }: { pattern: PatternTemplate }) => {
  const nodes = pattern.components;
  if (nodes.length === 0) return null;

  // Simple horizontal flow: show nodes as boxes with arrows
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1.5">
      {nodes.map((c, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div className="rounded border border-border bg-secondary/80 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground whitespace-nowrap max-w-[80px] truncate">
            {c.name}
          </div>
          {i < nodes.length - 1 && (
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
};

const PatternPicker = ({ onClose, onBeforeInsert }: PatternPickerProps) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<PatternCategory | "all">("all");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { insertPattern } = useDiagramActions();
  const rfInstance = useReactFlow();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = search.trim().toLowerCase();

  const filteredPatterns = useMemo(() => {
    let source: PatternTemplate[];
    if (activeCategory === "all") {
      source = PATTERNS;
    } else {
      source = PATTERNS_BY_CATEGORY[activeCategory];
    }
    if (!q) return source;
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.components.some((c) => c.name.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q),
    );
  }, [activeCategory, q]);

  const categoryCounts = useMemo(() => {
    if (!q) {
      return Object.fromEntries(
        CATEGORIES.map((cat) => [cat, PATTERNS_BY_CATEGORY[cat].length]),
      ) as Record<PatternCategory, number>;
    }
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      counts[cat] = PATTERNS_BY_CATEGORY[cat].filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.components.some((c) => c.name.toLowerCase().includes(q)),
      ).length;
    });
    return counts as Record<PatternCategory, number>;
  }, [q]);

  const totalCount = useMemo(() => {
    if (!q) return PATTERNS.length;
    return Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  }, [q, categoryCounts]);

  const handleInsert = (template: PatternTemplate) => {
    onBeforeInsert?.();
    insertPattern(template, getViewportCenter(rfInstance));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold">{t("patterns.modalTitle")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("patterns.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("patterns.searchPlaceholder")}
              className="w-full rounded-md border border-border bg-secondary py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <nav className="w-44 shrink-0 border-r border-border py-2 overflow-y-auto">
            <button
              onClick={() => setActiveCategory("all")}
              className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                activeCategory === "all"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <span>{t("patterns.categoryAll")}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{totalCount}</span>
            </button>
            <div className="border-t border-border my-1" />
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  disabled={q ? count === 0 : false}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                    activeCategory === cat
                      ? "bg-primary/10 text-primary"
                      : count === 0 && q
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
                  <span className="flex-1">{t(`patterns.category.${cat}`)}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Pattern cards */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredPatterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-xs text-muted-foreground">
                  {q ? t("patterns.noneFoundForQuery", { query: search.trim() }) : t("patterns.noneFound")}
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredPatterns.map((pattern) => (
                  <button
                    key={pattern.id}
                    onClick={() => handleInsert(pattern)}
                    className="text-left rounded-lg border border-border bg-card hover:bg-surface-hover hover:border-primary/40 transition-all p-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{CATEGORY_ICONS[pattern.category]}</span>
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {pattern.name}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                          {pattern.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                          {t("patterns.elementAbbrev", { count: pattern.components.length })}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                          {t("patterns.connAbbrev", { count: pattern.connections.length })}
                        </span>
                      </div>
                    </div>
                    <PatternFlowPreview pattern={pattern} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternPicker;
