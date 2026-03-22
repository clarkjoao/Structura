import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Diagram, Folder as FolderType } from "@/features/diagram";
import { useAllDiagrams, useFolders } from "@/features/diagram";
import { buildBreadcrumbPath } from "@/pages/Dashboard/dashboard.utils";
import { useRecentDiagrams } from "./useRecentDiagrams";

type FolderRecord = Record<string, FolderType>;

function diagramMatchesQuery(
  d: Diagram,
  folders: FolderRecord,
  q: string,
): boolean {
  const lc = q.trim().toLowerCase();
  if (!lc) return true;
  if (d.name.toLowerCase().includes(lc)) return true;
  const path = buildBreadcrumbPath(folders, d.folderId ?? null);
  if (path.some((p) => p.name.toLowerCase().includes(lc))) return true;
  if (d.folderId && folders[d.folderId]?.name.toLowerCase().includes(lc)) return true;
  return false;
}

function matchingFolders(folders: FolderRecord, q: string): FolderType[] {
  const lc = q.trim().toLowerCase();
  if (!lc) return [];
  return Object.values(folders).filter((f) => f.name.toLowerCase().includes(lc));
}

function pathLabel(folders: FolderRecord, d: Diagram): string {
  const path = buildBreadcrumbPath(folders, d.folderId ?? null);
  if (path.length === 0) return "";
  return `${path.map((f) => f.name).join("/")}/`;
}

export interface DiagramCommandPaletteProps {
  onClose: () => void;
  onSelectDiagram: (id: string) => void;
}

type PaletteRow =
  | { kind: "header"; key: string; title: string }
  | { kind: "folderHint"; key: string; name: string }
  | { kind: "diagram"; key: string; id: string; name: string; sub?: string; openedAt?: number };

export function DiagramCommandPalette({ onClose, onSelectDiagram }: DiagramCommandPaletteProps) {
  const { t, i18n } = useTranslation();
  const folders = useFolders();
  const allDiagrams = useAllDiagrams();
  const { recent } = useRecentDiagrams();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const locale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const diagramsById = useMemo(
    () => Object.fromEntries(allDiagrams.map((d) => [d.id, d])) as Record<string, Diagram>,
    [allDiagrams],
  );

  const recentResolved = useMemo(() => {
    return recent
      .map((r) => {
        const d = diagramsById[r.id];
        return d ? { ...r, name: d.name } : null;
      })
      .filter((x): x is (typeof recent)[0] & { name: string } => x !== null);
  }, [recent, diagramsById]);

  const q = query.trim();
  const hasQuery = q.length > 0;

  const { rows, selectableIndices } = useMemo(() => {
    const out: PaletteRow[] = [];
    const selectable: number[] = [];

    const pushDiagram = (row: Extract<PaletteRow, { kind: "diagram" }>) => {
      selectable.push(out.length);
      out.push(row);
    };

    if (hasQuery) {
      const folderHits = matchingFolders(folders, q);
      const diagramHits = allDiagrams.filter((d) => diagramMatchesQuery(d, folders, q));
      const recentFiltered = recentResolved.filter((r) =>
        r.name.toLowerCase().includes(q.toLowerCase()),
      );

      if (folderHits.length > 0) {
        out.push({ kind: "header", key: "h-folders", title: t("diagramNav.folders") });
        folderHits.forEach((f) => {
          out.push({
            kind: "folderHint",
            key: `folder:${f.id}`,
            name: f.name,
          });
        });
      }

      if (diagramHits.length > 0) {
        out.push({ kind: "header", key: "h-diagrams", title: t("diagramNav.diagrams") });
        diagramHits.forEach((d) => {
          pushDiagram({
            kind: "diagram",
            key: `d:${d.id}`,
            id: d.id,
            name: d.name,
            sub: pathLabel(folders, d) || undefined,
          });
        });
      }

      if (recentFiltered.length > 0) {
        out.push({ kind: "header", key: "h-recent", title: t("diagramNav.recent") });
        recentFiltered.forEach((r) => {
          pushDiagram({
            kind: "diagram",
            key: `r:${r.id}`,
            id: r.id,
            name: r.name,
            openedAt: r.openedAt,
          });
        });
      }
    } else {
      const recentIds = new Set(recentResolved.map((r) => r.id));
      const mostUsed = [...allDiagrams]
        .filter((d) => !recentIds.has(d.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 12);

      if (recentResolved.length > 0) {
        out.push({ kind: "header", key: "h-recent", title: t("diagramNav.recent") });
        recentResolved.forEach((r) => {
          pushDiagram({
            kind: "diagram",
            key: `r:${r.id}`,
            id: r.id,
            name: r.name,
            openedAt: r.openedAt,
          });
        });
      }

      if (mostUsed.length > 0) {
        out.push({ kind: "header", key: "h-used", title: t("diagramNav.mostUsed") });
        mostUsed.forEach((d) => {
          pushDiagram({
            kind: "diagram",
            key: `d:${d.id}`,
            id: d.id,
            name: d.name,
            sub: pathLabel(folders, d) || undefined,
          });
        });
      }
    }

    return { rows: out, selectableIndices: selectable };
  }, [allDiagrams, folders, hasQuery, q, recentResolved, t]);

  const selectableCount = selectableIndices.length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= selectableCount && selectableCount > 0) {
      setSelectedIndex(selectableCount - 1);
    }
  }, [selectableCount, selectedIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePick = useCallback(
    (id: string) => {
      onSelectDiagram(id);
      onClose();
    },
    [onSelectDiagram, onClose],
  );

  const moveSelectedIntoView = useCallback((indexInSelectable: number) => {
    const rowIndex = selectableIndices[indexInSelectable];
    if (rowIndex === undefined) return;
    const el = listRef.current?.querySelector(`[data-palette-row="${rowIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectableIndices]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement | HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (selectableCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = Math.min(i + 1, selectableCount - 1);
          moveSelectedIntoView(next);
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = Math.max(i - 1, 0);
          moveSelectedIntoView(next);
          return next;
        });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const rowIdx = selectableIndices[selectedIndex];
        const row = rowIdx !== undefined ? rows[rowIdx] : undefined;
        if (row?.kind === "diagram") handlePick(row.id);
        return;
      }
    },
    [handlePick, moveSelectedIntoView, onClose, rows, selectableCount, selectableIndices, selectedIndex],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[min(480px,70vh)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("diagramNav.commandPalette")}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("diagramNav.palettePlaceholder")}
            className="border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
            onKeyDown={handleKeyDown}
          />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("diagramNav.noMatches")}
            </p>
          ) : (
            <div className="space-y-0.5 px-1">
              {rows.map((row, i) => {
                if (row.kind === "header") {
                  return (
                    <p
                      key={row.key}
                      className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0"
                    >
                      {row.title}
                    </p>
                  );
                }
                if (row.kind === "folderHint") {
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 text-[10px]">{t("diagramNav.folderHitHint")}</span>
                    </div>
                  );
                }

                const si = selectableIndices.indexOf(i);
                const isSelected = si >= 0 && si === selectedIndex;
                return (
                  <button
                    key={row.key}
                    type="button"
                    data-palette-row={i}
                    onClick={() => handlePick(row.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                      isSelected ? "bg-primary/15 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    {row.sub && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">· {row.sub}</span>
                    )}
                    {row.openedAt !== undefined && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(row.openedAt, { addSuffix: true, locale })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
