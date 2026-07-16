import { memo, useState, useCallback, useRef, useId, useEffect, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp, Database, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import { useCollabHighlight } from "@/features/collaboration";
import { CompareSceneBadges, SceneElementBadge } from "../SceneElementBadge";
import { singleIncomingTargetHandleId } from "../../edges/connectionDerivations";
import type { DbColumnRow, DbTableColumnKey, DbTableNodeData } from "./DbTableNode.types";

interface ColDef {
  key: DbTableColumnKey;
  labelKey: string;
  width: number;
  isBoolean: boolean;
}

const COL_DEFS: ColDef[] = [
  { key: "name", labelKey: "dbTable.col.name", width: 120, isBoolean: false },
  { key: "dataType", labelKey: "dbTable.col.dataType", width: 90, isBoolean: false },
  { key: "isPrimaryKey", labelKey: "dbTable.col.pk", width: 36, isBoolean: true },
  { key: "isForeignKey", labelKey: "dbTable.col.fk", width: 36, isBoolean: true },
  { key: "nullable", labelKey: "dbTable.col.nn", width: 36, isBoolean: true },
  { key: "unique", labelKey: "dbTable.col.uq", width: 36, isBoolean: true },
];

const HEADER_H = 32;
const COL_H = 24;
const SHEET_HEADER_H = 22;
const ADD_BTN_SIZE = 20;

const dbTableIncomingHandleClassName =
  "!border-background transition-all duration-150 !w-2.5 !h-2.5 !bg-muted-foreground";

function DbTableIncomingHandle({ elementId }: { elementId: string }) {
  return (
    <Handle
      id={singleIncomingTargetHandleId(elementId)}
      type="target"
      position={Position.Left}
      className={dbTableIncomingHandleClassName}
    />
  );
}

function makeRow(id: string): DbColumnRow {
  return {
    id,
    name: "",
    dataType: "VARCHAR",
    isPrimaryKey: false,
    isForeignKey: false,
    nullable: true,
    unique: false,
  };
}

function totalWidth(visibleColDefs: ColDef[]): number {
  return 32 + visibleColDefs.reduce((acc, c) => acc + c.width, 0) + ADD_BTN_SIZE;
}

interface TextCellProps {
  value: string;
  colWidth: number;
  onBlur: (value: string) => void;
}

function TextCell({ value, colWidth, onBlur }: TextCellProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      className={cn(
        "h-full bg-transparent border-r border-border/40 px-1.5",
        "text-[11px] font-mono text-foreground outline-none",
        "focus:bg-primary/5 focus:ring-1 focus:ring-inset focus:ring-primary/40",
        "nodrag",
      )}
      style={{ width: colWidth }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onBlur(draft)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (keyIs(e, KEY.ENTER)) (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface BoolCellProps {
  value: boolean;
  colWidth: number;
  onChange: (value: boolean) => void;
}

function BoolCell({ value, colWidth, onChange }: BoolCellProps) {
  return (
    <div
      className={cn(
        "h-full flex items-center justify-center border-r border-border/40 cursor-pointer shrink-0",
        "hover:bg-muted/60 nodrag",
      )}
      style={{ width: colWidth }}
      onClick={() => onChange(!value)}
      role="checkbox"
      aria-checked={value}
    >
      {value ? <div className="w-3 h-3 rounded-sm bg-primary/80" /> : null}
    </div>
  );
}

const DbTableNode = memo(({ data: d, selected }: NodeProps<Node<DbTableNodeData>>) => {
  const { t } = useTranslation();
  const isActive = selected || d.isSelected;
  const collapsed = d.collapsed ?? false;
  const onToggleCollapse = d.onToggleCollapse;
  const collabHighlight = useCollabHighlight(d.elementId);
  const titleText = d.tableName?.trim() ? d.tableName : t("dbTable.unnamedTable");
  const uid = useId();

  const [rows, setRows] = useState<DbColumnRow[]>(() => d.columns);
  const [visibleCols, setVisibleCols] = useState<ColDef[]>(COL_DEFS);

  const columnsSignature = useMemo(
    () =>
      JSON.stringify(
        d.columns.map((r) => [
          r.id,
          r.name,
          r.dataType,
          r.isPrimaryKey,
          r.isForeignKey,
          r.nullable,
          r.unique,
        ]),
      ),
    [d.columns],
  );

  const lastSignatureRef = useRef(columnsSignature);
  useEffect(() => {
    if (columnsSignature === lastSignatureRef.current) return;
    lastSignatureRef.current = columnsSignature;
    setRows(d.columns.map((c) => ({ ...c })));
  }, [columnsSignature, d.columns]);

  const onCommitRef = useRef(d.onCommit);
  onCommitRef.current = d.onCommit;

  const commit = useCallback((nextRows: DbColumnRow[]) => {
    onCommitRef.current(nextRows);
  }, []);

  const applyRowPatch = useCallback(
    (rowId: string, key: DbTableColumnKey, value: string | boolean) => {
      setRows((prev) => {
        const nextRows = prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row));
        commit(nextRows);
        return nextRows;
      });
    },
    [commit],
  );

  const handleAddRow = useCallback(() => {
    setRows((prev) => {
      const nextRows = [...prev, makeRow(`${uid}-${Date.now()}`)];
      commit(nextRows);
      return nextRows;
    });
  }, [commit, uid]);

  const handleRemoveRow = useCallback(
    (rowId: string) => {
      setRows((prev) => {
        const nextRows = prev.filter((r) => r.id !== rowId);
        commit(nextRows);
        return nextRows;
      });
    },
    [commit],
  );

  const hiddenCols = useMemo(
    () => COL_DEFS.filter((c) => !visibleCols.some((v) => v.key === c.key)),
    [visibleCols],
  );

  const handleAddCol = useCallback(() => {
    setVisibleCols((prev) => {
      const hidden = COL_DEFS.filter((c) => !prev.some((v) => v.key === c.key));
      if (hidden.length === 0) return prev;
      return [...prev, hidden[0]];
    });
  }, []);

  const handleRemoveCol = useCallback((key: DbTableColumnKey) => {
    if (key === "name" || key === "dataType") return;
    setVisibleCols((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const tableW = totalWidth(visibleCols);
  const nodeH = HEADER_H + SHEET_HEADER_H + rows.length * COL_H + ADD_BTN_SIZE + 2;

  const selectedRing = "border-primary ring-2 ring-primary/30 shadow-lg";
  const unselectedShadow = "border-border shadow-md hover:shadow-lg";

  if (collapsed) {
    return (
      <div
        aria-label={t("dbTable.ariaLabel", { name: d.tableName })}
        className={cn(
          "relative w-full h-full rounded-md flex items-center gap-2 px-3 transition-all duration-200 overflow-hidden select-none",
          "bg-card text-card-foreground",
          isActive ? selectedRing : unselectedShadow,
        )}
      >
        <DbTableIncomingHandle elementId={d.elementId} />
        {collabHighlight ? (
          <div
            className="absolute inset-0 pointer-events-none rounded-md z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        ) : null}
        {d.compareBadges ? (
          <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />
        ) : null}
        {!d.compareBadges && d.sceneBadge ? (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        ) : null}
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold truncate block font-mono">{titleText}</span>
          <span className="text-[10px] text-muted-foreground truncate block">
            {t("dbTable.columnCount", { count: rows.length })}
          </span>
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={t("dbTable.expandAria")}
            aria-expanded={false}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted nodrag"
            title={t("dbTable.expandTitle")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-label={t("dbTable.ariaLabel", { name: d.tableName })}
      className={cn(
        "relative flex flex-col overflow-visible rounded-md border select-none",
        "bg-card text-card-foreground transition-shadow duration-200",
        isActive ? selectedRing : unselectedShadow,
      )}
      style={{ width: tableW, height: nodeH, minWidth: tableW }}
    >
      <DbTableIncomingHandle elementId={d.elementId} />
      {collabHighlight ? (
        <div
          className="absolute inset-0 pointer-events-none rounded-md z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
        />
      ) : null}
      {d.compareBadges ? <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} /> : null}
      {!d.compareBadges && d.sceneBadge ? (
        <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
      ) : null}

      <div
        className="relative flex items-center gap-2 px-3 bg-muted/70 border-b border-border shrink-0 rounded-t-md"
        style={{ height: HEADER_H }}
      >
        {d.customColor && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: d.customColor }}
          />
        )}
        <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-xs font-semibold truncate flex-1 font-mono">
          {d.tableName || t("dbTable.unnamedTable")}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {t("dbTable.columnCount", { count: rows.length })}
        </span>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={t("dbTable.collapseAria")}
            aria-expanded={true}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted/80 nodrag"
            title={t("dbTable.collapseTitle")}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div
          className="flex shrink-0 bg-muted/50 border-b border-border"
          style={{ height: SHEET_HEADER_H }}
        >
          <div className="shrink-0 border-r border-border/40" style={{ width: 32 }} />

          {visibleCols.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-center border-r border-border/40 group relative"
              style={{ width: col.width, height: SHEET_HEADER_H }}
            >
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t(col.labelKey)}
              </span>
              {col.key !== "name" && col.key !== "dataType" ? (
                <button
                  type="button"
                  onClick={() => handleRemoveCol(col.key)}
                  className={cn(
                    "absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full",
                    "bg-destructive text-destructive-foreground",
                    "flex items-center justify-center opacity-0 group-hover:opacity-100",
                    "transition-opacity nodrag",
                  )}
                  aria-label={t("dbTable.removeCol")}
                >
                  <X className="w-2 h-2" />
                </button>
              ) : null}
            </div>
          ))}

          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: ADD_BTN_SIZE }}
          >
            {hiddenCols.length > 0 ? (
              <button
                type="button"
                onClick={handleAddCol}
                className={cn(
                  "w-4 h-4 rounded-sm flex items-center justify-center",
                  "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground",
                  "nodrag transition-colors",
                )}
                aria-label={t("dbTable.addCol")}
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            ) : null}
          </div>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex shrink-0 border-b border-border/30 group hover:bg-muted/20"
            style={{ height: COL_H }}
          >
            <div
              className="shrink-0 flex items-center justify-center border-r border-border/40"
              style={{ width: 32, height: COL_H }}
            >
              <button
                type="button"
                onClick={() => handleRemoveRow(row.id)}
                className={cn(
                  "w-4 h-4 rounded-sm flex items-center justify-center",
                  "text-muted-foreground opacity-0 group-hover:opacity-100",
                  "hover:bg-destructive/10 hover:text-destructive",
                  "nodrag transition-opacity",
                )}
                aria-label={t("dbTable.removeRow")}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>

            {visibleCols.map((col) =>
              col.isBoolean ? (
                <BoolCell
                  key={col.key}
                  value={row[col.key] as boolean}
                  colWidth={col.width}
                  onChange={(val) => applyRowPatch(row.id, col.key, val)}
                />
              ) : (
                <TextCell
                  key={col.key}
                  value={row[col.key] as string}
                  colWidth={col.width}
                  onBlur={(val) => applyRowPatch(row.id, col.key, val)}
                />
              ),
            )}

            <div className="shrink-0" style={{ width: ADD_BTN_SIZE }} />
          </div>
        ))}

        <div className="flex items-center shrink-0" style={{ height: ADD_BTN_SIZE }}>
          <button
            type="button"
            onClick={handleAddRow}
            className={cn(
              "flex items-center gap-1 px-2 h-full",
              "text-[10px] text-muted-foreground hover:text-foreground",
              "hover:bg-accent transition-colors nodrag",
            )}
            aria-label={t("dbTable.addRow")}
          >
            <Plus className="w-2.5 h-2.5" />
            <span>{t("dbTable.addRow")}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

DbTableNode.displayName = "DbTableNode";

export default DbTableNode;
