import DbTableNode from "../DbTableNode";
import type { DbColumn } from "@/features/diagram";
import { isDbTableComponent, isDbTableType } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import { DB_TABLE_COLLAPSED_H, DB_TABLE_COLLAPSED_W } from "../../constants";

const DB_TABLE_MAX_W = 32 + 120 + 90 + 36 + 36 + 36 + 36 + 20;

const DB_TABLE_FIXED_H = 32 + 22 + 20 + 2;
const DB_TABLE_ROW_H = 24;

export const dbTableDescriptor: NodeTypeDescriptor = {
  rfType: "db-table",
  component: DbTableNode,
  matches: isDbTableType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: DB_TABLE_MAX_W, height: 180 },

  buildData: (comp, ctx) => {
    if (!isDbTableComponent(comp)) return {};

    return {
      elementId: comp.id,
      tableName: comp.tableName || comp.name,
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
      return {
        width: DB_TABLE_COLLAPSED_W,
        height: DB_TABLE_COLLAPSED_H,
      };
    }
    const rowCount = comp.columns.length;
    const autoHeight = DB_TABLE_FIXED_H + rowCount * DB_TABLE_ROW_H;
    return {
      width: layout?.width ?? DB_TABLE_MAX_W,
      height: autoHeight,
    };
  },
};
