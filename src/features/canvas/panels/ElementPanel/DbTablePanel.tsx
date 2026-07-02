import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import debounce from "lodash.debounce";
import { X, Trash2, Table, Plus, GripVertical, Key, Link } from "lucide-react";
import { useTranslation } from "react-i18next";
import { generateId, type DbTableComponent, type DbColumn } from "@/features/diagram";
import { FIELD_DEBOUNCE_MS } from "@/features/canvas/canvas.constants";
import { cn } from "@/lib/utils";

interface DbTablePanelProps {
  component: DbTableComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: Partial<Omit<DbTableComponent, "id">>) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
}

function makeColumn(id: string): DbColumn {
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

interface ColumnRowPanelProps {
  column: DbColumn;
  index: number;
  isDragging: boolean;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  onRemove: (id: string) => void;
}

function ColumnRowPanel({
  column,
  index,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onRemove,
}: ColumnRowPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md border group",
        "bg-secondary/40 hover:bg-secondary/70 transition-colors cursor-grab",
        isDragging && "opacity-40 border-primary",
        !isDragging && "border-border/60",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />

      <span className="w-4 shrink-0 flex items-center justify-center">
        {column.isPrimaryKey ? <Key className="h-3 w-3 text-amber-500" strokeWidth={2} /> : null}
        {!column.isPrimaryKey && column.isForeignKey ? (
          <Link className="h-3 w-3 text-blue-400" strokeWidth={2} />
        ) : null}
      </span>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono font-medium truncate block text-foreground">
          {column.name || t("dbTable.unnamedColumn")}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {column.dataType}
          {!column.nullable ? " NN" : ""}
          {column.unique && !column.isPrimaryKey ? " UQ" : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(column.id);
        }}
        className={cn(
          "p-1 rounded opacity-0 group-hover:opacity-100",
          "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          "transition-opacity",
        )}
        aria-label={t("dbTable.removeCol")}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function DbTablePanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
}: DbTablePanelProps) {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [focusTitleTrigger]);

  const [name, setName] = useState(component.name);
  const [description, setDescription] = useState(component.description ?? "");
  const [columns, setColumns] = useState<DbColumn[]>(component.columns);

  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useEffect(() => {
    setName(component.name);
    setDescription(component.description ?? "");
    setColumns(component.columns);
  }, [component.id]);

  useEffect(() => {
    if (draggingIndex !== null) return;
    setColumns(component.columns);
  }, [component.columns, draggingIndex]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((patch: Partial<Omit<DbTableComponent, "id">>) => {
        updateComponent(component.id, patch);
      }, FIELD_DEBOUNCE_MS),
    [component.id, updateComponent],
  );

  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  const commitColumns = useCallback(
    (nextColumns: DbColumn[]) => {
      setColumns(nextColumns);
      updateComponent(component.id, { columns: nextColumns });
    },
    [component.id, updateComponent],
  );

  const handleAddColumn = useCallback(() => {
    const nextColumns = [...columnsRef.current, makeColumn(generateId("col"))];
    commitColumns(nextColumns);
  }, [commitColumns]);

  const handleRemoveColumn = useCallback(
    (columnId: string) => {
      const nextColumns = columnsRef.current.filter((column) => column.id !== columnId);
      commitColumns(nextColumns);
    },
    [commitColumns],
  );

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === index) return;
    const current = columnsRef.current;
    const nextColumns = [...current];
    const [moved] = nextColumns.splice(fromIndex, 1);
    nextColumns.splice(index, 0, moved);
    dragIndexRef.current = index;
    setDraggingIndex(index);
    setColumns(nextColumns);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    updateComponent(component.id, { columns: columnsRef.current });
  }, [component.id, updateComponent]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Table className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 truncate">
          {t("dbTable.panelTitle")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-4 p-4">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.name")}
            </label>
            <input
              ref={titleInputRef}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                debouncedUpdate({ name: value, tableName: value });
              }}
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.description")}
            </label>
            <textarea
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={3}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                debouncedUpdate({ description: event.target.value });
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                {t("dbTable.columnsLabel")}
                <span className="ml-1 text-muted-foreground/60 normal-case font-normal">
                  ({columns.length})
                </span>
              </label>
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                aria-label={t("dbTable.addRow")}
              >
                <Plus className="h-3 w-3" />
                {t("dbTable.addRow")}
              </button>
            </div>

            <div className="flex flex-col gap-1" onDragOver={(event) => event.preventDefault()}>
              {columns.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground px-2 py-3 text-center border border-dashed border-border rounded-md">
                  {t("dbTable.noColumns")}
                </p>
              ) : (
                columns.map((column, index) => (
                  <ColumnRowPanel
                    key={column.id}
                    column={column}
                    index={index}
                    isDragging={draggingIndex === index}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDragEnd={handleDragEnd}
                    onRemove={handleRemoveColumn}
                  />
                ))
              )}
            </div>

            <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
              {t("dbTable.reorderHint")}
            </p>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.idLabel")}
            </label>
            <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">
              {component.id}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                debouncedUpdate.cancel();
                removeComponent(component.id);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("elementPanel.remove")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
