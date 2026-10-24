import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, GripVertical, Key, Link } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  generateId,
  type ComponentPatch,
  type DbTableComponent,
  type DbColumn,
} from "@/features/diagram";
import { CommitField, ElementScaffold, PanelSection } from "./shell";
import { cn } from "@/lib/utils";

interface DbTablePanelProps {
  component: DbTableComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
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
  onFocusElement,
}: DbTablePanelProps) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<DbColumn[]>(component.columns);

  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useEffect(() => {
    if (draggingIndex !== null) return;
    setColumns(component.columns);
  }, [component.columns, draggingIndex]);

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
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      nameToPatch={(value) => ({ name: value, tableName: value })}
      namePlaceholder={t("dbTable.panelTitle")}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <CommitField
          label={t("common.description")}
          value={component.description ?? ""}
          multiline
          addLabel={t("panelShell.addDescription")}
          onCommit={(value) => updateComponent(component.id, { description: value })}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("dbTable.columnsLabel")}
              <span className="ml-1 font-normal text-muted-foreground/60">({columns.length})</span>
            </span>
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
              <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-[11px] italic text-muted-foreground">
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

          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
            {t("dbTable.reorderHint")}
          </p>
        </div>
      </PanelSection>
    </ElementScaffold>
  );
}
