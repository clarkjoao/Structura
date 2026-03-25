import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Layers, Bookmark } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import {
  PATTERNS,
  PATTERNS_BY_CATEGORY,
  PATTERN_CATEGORIES,
  type PatternCategory,
  type PatternTemplate,
} from "@/lib/catalogs/patterns";
import type { UserTemplate } from "@/features/diagram";
import { useAllUserTemplates, useDiagramActions } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { useTranslation } from "react-i18next";
import { PatternFlowPreview } from "./PatternFlowPreview";
import { UserTemplateCard } from "./UserTemplateCard";

const CATEGORIES = PATTERN_CATEGORIES;

type ActiveCategory = PatternCategory | "all" | "user-templates";

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

const PatternPicker = ({ onClose, onBeforeInsert }: PatternPickerProps) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { insertPattern, deleteUserTemplate, updateUserTemplate } = useDiagramActions();
  const userTemplates = useAllUserTemplates();
  const rfInstance = useReactFlow();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (userTemplates.length === 0 && activeCategory === "user-templates") {
      setActiveCategory("all");
    }
  }, [userTemplates.length, activeCategory]);

  const q = search.trim().toLowerCase();

  const filteredUserTemplates = useMemo(() => {
    if (!q) return userTemplates;
    return userTemplates.filter(
      (template) =>
        template.name.toLowerCase().includes(q) ||
        (template.description?.toLowerCase().includes(q) ?? false) ||
        (template.category?.toLowerCase().includes(q) ?? false) ||
        template.components.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [userTemplates, q]);

  const filteredBuiltinsAll = useMemo(() => {
    if (!q) return PATTERNS;
    return PATTERNS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.components.some((c) => c.name.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q),
    );
  }, [q]);

  const filteredPatternsForCategory = useMemo(() => {
    if (activeCategory === "all" || activeCategory === "user-templates") {
      return [];
    }
    const source = PATTERNS_BY_CATEGORY[activeCategory];
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

  const allRowCount = filteredBuiltinsAll.length + filteredUserTemplates.length;

  const handleInsert = (template: PatternTemplate) => {
    onBeforeInsert?.();
    insertPattern(template, getViewportCenter(rfInstance));
    onClose();
  };

  const handleInsertUserTemplate = (template: UserTemplate) => {
    onBeforeInsert?.();
    insertPattern(template, getViewportCenter(rfInstance));
    onClose();
  };

  const renderBuiltinCards = (patterns: PatternTemplate[]) => (
    <div className="grid gap-2">
      {patterns.map((pattern) => (
        <button
          key={pattern.id}
          type="button"
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
          <PatternFlowPreview components={pattern.components} />
        </button>
      ))}
    </div>
  );

  const renderMainEmpty = (forQuery: boolean) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-xs text-muted-foreground">
        {forQuery ? t("patterns.noneFoundForQuery", { query: search.trim() }) : t("patterns.noneFound")}
      </p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[80vh] my-auto rounded-xl border border-border bg-card shadow-2xl flex flex-col min-h-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
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
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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

        <div className="flex flex-1 overflow-hidden min-h-0">
          <nav className="w-44 shrink-0 border-r border-border py-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                activeCategory === "all"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <span>{t("patterns.categoryAll")}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{allRowCount}</span>
            </button>
             {userTemplates.length > 0 ? (
              <>
                <div className="border-t border-border my-1" />
                <button
                  type="button"
                  onClick={() => setActiveCategory("user-templates")}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                    activeCategory === "user-templates"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1">{t("patterns.categories.userTemplates")}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {q ? filteredUserTemplates.length : userTemplates.length}
                  </span>
                </button>
              </>
            ) : null}
            <div className="border-t border-border my-1" />
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  type="button"
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
                  <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto p-3 min-w-0">
            {activeCategory === "all" ? (
              <>
                {filteredBuiltinsAll.length === 0 && filteredUserTemplates.length === 0 ? (
                  renderMainEmpty(q.length > 0)
                ) : (
                  <>
                    {filteredBuiltinsAll.length > 0 ? renderBuiltinCards(filteredBuiltinsAll) : null}
                    {filteredUserTemplates.length > 0 ? (
                      <>
                        {filteredBuiltinsAll.length > 0 ? (
                          <div className="px-1 pt-3 mt-3 border-t border-border">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              {t("patterns.categories.userTemplates")}
                            </p>
                          </div>
                        ) : null}
                        <div className="grid gap-2">
                          {filteredUserTemplates.map((template) => (
                            <UserTemplateCard
                              key={template.id}
                              template={template}
                              onInsert={() => handleInsertUserTemplate(template)}
                              onDelete={() => deleteUserTemplate(template.id)}
                              onRename={(name) => updateUserTemplate(template.id, { name })}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            {activeCategory === "user-templates" ? (
              filteredUserTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 px-4 text-muted-foreground">
                  <p className="text-[13px]">
                    {q ? t("patterns.noneFoundForQuery", { query: search.trim() }) : t("patterns.userTemplates.empty")}
                  </p>
                  {!q ? (
                    <p className="text-xs mt-1 max-w-sm">{t("patterns.userTemplates.emptyHint")}</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredUserTemplates.map((template) => (
                    <UserTemplateCard
                      key={template.id}
                      template={template}
                      onInsert={() => handleInsertUserTemplate(template)}
                      onDelete={() => deleteUserTemplate(template.id)}
                      onRename={(name) => updateUserTemplate(template.id, { name })}
                    />
                  ))}
                </div>
              )
            ) : null}

            {activeCategory !== "all" && activeCategory !== "user-templates" ? (
              filteredPatternsForCategory.length === 0 ? (
                renderMainEmpty(q.length > 0)
              ) : (
                renderBuiltinCards(filteredPatternsForCategory)
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternPicker;
