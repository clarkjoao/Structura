import { Table } from "lucide-react";
import { createElement } from "react";
import DbTableNode from "@/features/canvas/nodes/DbTableNode";
import DbTablePanel from "@/features/canvas/panels/ElementPanel/DbTablePanel";
import { SINGLE_INCOMING_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { DB_TABLE_COLLAPSED_H, DB_TABLE_COLLAPSED_W } from "@/features/canvas/canvas.constants";
import { COMPONENT_TYPE_DB_TABLE } from "@/features/diagram/model/component-type-constants";
import { isDbTableComponent } from "@/features/diagram/model/component.guards";
import type { DbColumn } from "@/features/diagram/model/component.types";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

/** Header cell + the six column cells + padding: the table draws at a fixed width. */
const DB_TABLE_W = 32 + 120 + 90 + 36 + 36 + 36 + 36 + 20;

/** Header, column-title row, footer, borders — everything that is not a column row. */
const DB_TABLE_FIXED_H = 32 + 22 + 20 + 2;
const DB_TABLE_ROW_H = 24;

/** The height the table draws at for a given column count. */
function dbTableHeightFor(columnCount: number): number {
  return DB_TABLE_FIXED_H + columnCount * DB_TABLE_ROW_H;
}

/** See `JsonViewerInspector`: narrowing here is what keeps the contract cast-free. */
function DbTableInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  if (!isDbTableComponent(component)) return null;
  return createElement(DbTablePanel, { component, ...rest });
}

export const dbTableElement: ElementDescriptor = {
  id: COMPONENT_TYPE_DB_TABLE,
  family: "structural",
  labelKey: "nodeTypes.db-table",
  descriptionKey: "elements.db-table.description",

  model: {
    createComponent: (base) => {
      const tableName = base.name.trim().length > 0 ? base.name : i18n.t("dbTable.unnamedTable");
      return {
        ...base,
        name: tableName,
        type: COMPONENT_TYPE_DB_TABLE,
        tableName,
        columns: [],
      };
    },
    // A new table has no columns, so this is `dbTableHeightFor(0)` — the size it
    // is created at and the size it paints at agree at creation, and diverge
    // from there as columns are added. See `derivesSize` below.
    defaultSize: { width: DB_TABLE_W, height: dbTableHeightFor(0) },
    patchableKeys: ["tableName", "columns", "collapsed", "collapsedWidth", "collapsedHeight"],
  },

  canvas: {
    rfType: "db-table",
    component: DbTableNode,
    handles: SINGLE_INCOMING_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    // A table is a thing the diagram points at; nothing leaves it.
    canBeConnectionSource: false,
    /**
     * The painted height is the column count, not the stored layout: adding a
     * column grows the box without anyone resizing it. `model.defaultSize` is
     * therefore only the size at creation, and the two agree solely while the
     * table is empty.
     */
    derivesSize: true,

    buildData: (comp, ctx) => {
      if (!isDbTableComponent(comp)) return {};

      return {
        elementId: comp.id,
        tableName: comp.tableName || comp.name,
        customColor: (comp as { customColor?: string }).customColor,
        columns: comp.columns.map((col) => ({
          id: col.id,
          name: col.name,
          dataType: col.dataType,
          isPrimaryKey: col.isPrimaryKey ?? false,
          isForeignKey: col.isForeignKey ?? false,
          nullable: col.nullable ?? true,
          unique: col.unique ?? false,
        })),
        isSelected: ctx.selectedNodeId === comp.id,
        collapsed: comp.collapsed ?? false,
        onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
        onCommit: (columns: DbColumn[]) => {
          const merged: DbColumn[] = columns.map((r) => {
            const prev = comp.columns.find((p) => p.id === r.id);
            return {
              id: r.id,
              name: r.name,
              dataType: r.dataType,
              isPrimaryKey: r.isPrimaryKey,
              isForeignKey: r.isForeignKey,
              nullable: r.nullable,
              unique: r.unique,
              ...(prev?.foreignTableId ? { foreignTableId: prev.foreignTableId } : {}),
            };
          });
          ctx.updateComponent?.(comp.id, { columns: merged });
        },
        ...sceneBadgePropsForNode(ctx, comp.id),
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isDbTableComponent(comp)) return undefined;
      const layout = ctx.resolvedNodeLayouts[comp.id];
      if (comp.collapsed) {
        return { width: DB_TABLE_COLLAPSED_W, height: DB_TABLE_COLLAPSED_H };
      }
      return {
        width: layout?.width ?? DB_TABLE_W,
        height: dbTableHeightFor(comp.columns.length),
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Table },
    accent: { kind: "neutral" },
    searchKeys: ["table", "database", "db", "schema", "sql", "columns"],
  },

  inspector: {
    panel: DbTableInspector,
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isDbTableComponent(comp)) {
          throw new Error(`[elements] db-table export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "dbTable",
          tableName: comp.tableName,
          columns: comp.columns.map((col) => ({ name: col.name, dataType: col.dataType })),
        };
      },
    },
  },
};
