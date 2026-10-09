import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import type { PatternCategory, PatternTemplate } from "@/lib/catalogs/patterns";
import {
  importTemplateFromFile,
  saveUserTemplate,
  useAllUserTemplates,
  useDiagramActions,
  type UserTemplate,
} from "@/features/diagram";
import { KEY, keyIs } from "@/lib/core/keyboard";
import {
  NEUTRAL_PROVIDER,
  patternDescriptionKey,
  patternNameKey,
  patternNodeKey,
  patternProviders,
  patternReference,
} from "@/features/elements/patterns";
import { getCloudFamily } from "@/features/elements/families/cloud-family.registry";
import { usePatternProvider } from "./usePatternProvider";
import { cn } from "@/lib/utils";
import { PatternFlowPreview } from "./PatternFlowPreview";
import {
  PATTERN_FILTERS,
  patternsForFilter,
  searchPatterns,
  type PatternFilter,
} from "./patternSearch";
import { UserTemplateCard } from "./UserTemplateCard";

const CATEGORY_ICONS: Record<PatternCategory, string> = {
  "integration-messaging": "📨",
  "api-edge": "🔌",
  "data-consistency": "🗄️",
  resilience: "🛡️",
  "migration-modernization": "🧭",
  "deployment-scale": "🚀",
  "security-identity": "🔐",
  structure: "🧩",
};

/** What the host's search field forwards: ↑↓ and ↵ while the patterns are shown. */
export interface PatternBrowserHandle {
  /** True when the key was used. */
  handleKey: (event: React.KeyboardEvent) => boolean;
}

interface PatternBrowserProps {
  /** The host's search text; the browser has no field of its own. */
  query: string;
  /** Prefix for option ids, so the host's field can point at them. */
  idPrefix: string;
  /** The id of the option the keyboard is on, for `aria-activedescendant`. */
  onActiveIdChange: (id: string | null) => void;
  onInsert: (template: PatternTemplate | UserTemplate) => void;
}

type PatternOption =
  | { key: string; kind: "builtin"; pattern: PatternTemplate }
  | { key: string; kind: "user"; template: UserTemplate };

const SUB_CHIP_CLASS =
  "flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors";

/**
 * Architecture patterns and saved templates — sets of elements inserted
 * together. Shown inside the element catalog but kept apart from it: a
 * pattern is not a catalog entry (it creates many nodes), so it has its own
 * search, filters and insert path.
 */
export const PatternBrowser = forwardRef<PatternBrowserHandle, PatternBrowserProps>(
  function PatternBrowser({ query, idPrefix, onActiveIdChange, onInsert }, ref) {
    const { t, i18n } = useTranslation();
    const userTemplates = useAllUserTemplates();
    const { deleteUserTemplate, updateUserTemplate } = useDiagramActions();
    const [filter, setFilter] = useState<PatternFilter>("all");
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const result = useMemo(() => searchPatterns(query, userTemplates), [query, userTemplates]);
    const [provider, setProvider] = usePatternProvider();
    const providers = useMemo(
      () =>
        patternProviders().map((id) => {
          if (id === NEUTRAL_PROVIDER) return { id, label: t("patterns.provider.neutral") };
          const family = getCloudFamily(id);
          const groupKey = `elementCatalog.groups.${family?.paletteCategoryId ?? id}`;
          const label = i18n.exists(groupKey) ? t(groupKey) : family ? t(family.labelKey) : id;
          return { id, label };
        }),
      // Labels follow the language.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [t, i18n.language],
    );
    const shown = useMemo(() => patternsForFilter(result, filter), [result, filter]);
    const options = useMemo(
      (): PatternOption[] => [
        ...shown.builtins.map((pattern) => ({
          key: `builtin:${pattern.id}`,
          kind: "builtin" as const,
          pattern,
        })),
        ...shown.userTemplates.map((template) => ({
          key: `user:${template.id}`,
          kind: "user" as const,
          template,
        })),
      ],
      [shown],
    );

    const optionId = (key: string) => `${idPrefix}-${key}`;

    useEffect(() => {
      setActiveKey(options[0]?.key ?? null);
    }, [options]);

    useEffect(() => {
      onActiveIdChange(activeKey ? optionId(activeKey) : null);
      if (activeKey) {
        document.getElementById(optionId(activeKey))?.scrollIntoView({ block: "nearest" });
      }
      // `optionId` only reads the prefix.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeKey, onActiveIdChange]);

    useEffect(() => () => onActiveIdChange(null), [onActiveIdChange]);

    const insert = (option: PatternOption) =>
      onInsert(option.kind === "builtin" ? option.pattern : option.template);

    useImperativeHandle(
      ref,
      () => ({
        handleKey: (event) => {
          const at = options.findIndex((option) => option.key === activeKey);
          if (keyIs(event, KEY.ARROW_DOWN) || keyIs(event, KEY.ARROW_UP)) {
            const next = keyIs(event, KEY.ARROW_DOWN)
              ? Math.min(at + 1, options.length - 1)
              : Math.max(at - 1, 0);
            setActiveKey(options[next]?.key ?? null);
            return true;
          }
          if (keyIs(event, KEY.ENTER)) {
            const active = options[at];
            if (active) insert(active);
            return true;
          }
          return false;
        },
      }),
      // `insert` closes over `onInsert` only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [options, activeKey, onInsert],
    );

    const handleImportChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const imported = await importTemplateFromFile(file);
      if (!imported.ok) {
        toast.error(t("patterns.userTemplates.importError"));
        return;
      }
      saveUserTemplate(imported.template);
      toast.success(t("patterns.userTemplates.importSuccess", { name: imported.template.name }));
    };

    const filterLabel = (value: PatternFilter) =>
      value === "all"
        ? t("patterns.categoryAll")
        : value === "user-templates"
          ? t("patterns.categories.userTemplates")
          : `${CATEGORY_ICONS[value]} ${t(`patterns.category.${value}`)}`;

    const trimmed = query.trim();

    return (
      <div className="flex flex-col gap-3">
        <div
          role="radiogroup"
          aria-label={t("patterns.provider.label")}
          className="flex items-center gap-1 self-start rounded-lg border border-border p-0.5"
        >
          <span className="px-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("patterns.provider.label")}
          </span>
          {providers.map((option) => {
            const checked = option.id === provider;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setProvider(option.id)}
                className={cn(
                  "h-6 rounded-md px-2 text-[11px] transition-colors",
                  checked
                    ? "bg-primary/10 text-foreground ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label={t("patterns.modalTitle")} className="flex flex-wrap gap-1.5">
          {PATTERN_FILTERS.map((value) => {
            const pressed = value === filter;
            const count = result.counts[value];
            return (
              <button
                key={value}
                type="button"
                tabIndex={-1}
                aria-pressed={pressed}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setFilter(value)}
                disabled={!pressed && count === 0 && value !== "user-templates"}
                className={cn(
                  SUB_CHIP_CLASS,
                  pressed
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-40",
                )}
              >
                {filterLabel(value)}
                <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        {filter === "user-templates" && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => importInputRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Upload aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {t("patterns.userTemplates.importTemplate")}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportChange}
            />
          </>
        )}

        {options.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <p>
              {trimmed
                ? t("patterns.noneFoundForQuery", { query: trimmed })
                : filter === "user-templates"
                  ? t("patterns.userTemplates.empty")
                  : t("patterns.noneFound")}
            </p>
            {!trimmed && filter === "user-templates" && (
              <p className="mt-1">{t("patterns.userTemplates.emptyHint")}</p>
            )}
          </div>
        ) : (
          <div role="presentation" className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const active = option.key === activeKey;
              const frame = cn(
                "rounded-lg border transition-colors",
                active ? "border-primary bg-primary/10" : "border-border",
              );
              if (option.kind === "user") {
                return (
                  <div
                    key={option.key}
                    id={optionId(option.key)}
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => !active && setActiveKey(option.key)}
                    className={frame}
                  >
                    <UserTemplateCard
                      template={option.template}
                      onInsert={() => insert(option)}
                      onDelete={() => deleteUserTemplate(option.template.id)}
                      onRename={(name) => updateUserTemplate(option.template.id, { name })}
                    />
                  </div>
                );
              }
              const { pattern } = option;
              const leaves = pattern.nodes.filter(
                (node) => !pattern.nodes.some((other) => other.parent === node.key),
              );
              return (
                <div
                  key={option.key}
                  id={optionId(option.key)}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => !active && setActiveKey(option.key)}
                  onClick={() => insert(option)}
                  className={cn(frame, "cursor-pointer p-3 text-left hover:bg-surface-hover")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        <span aria-hidden className="mr-1">
                          {CATEGORY_ICONS[pattern.category]}
                        </span>
                        {t(patternNameKey(pattern))}
                      </p>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                        {t(patternDescriptionKey(pattern))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t("patterns.elementAbbrev", { count: leaves.length })}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t("patterns.connAbbrev", { count: pattern.edges.length })}
                      </span>
                    </div>
                  </div>
                  <PatternFlowPreview
                    components={leaves.map((node) => ({ name: t(patternNodeKey(pattern, node)) }))}
                  />
                  <a
                    href={patternReference(pattern, i18n.language)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink aria-hidden className="h-3 w-3" />
                    {t("patterns.reference")}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
