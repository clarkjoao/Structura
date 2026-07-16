export type DbTableColumnKey =
  "name" | "dataType" | "isPrimaryKey" | "isForeignKey" | "nullable" | "unique";

export interface DbColumnRow {
  id: string;
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  nullable: boolean;
  unique: boolean;
}

export type DbTableNodeData = {
  elementId: string;
  tableName: string;
  customColor?: string;
  columns: DbColumnRow[];
  isSelected: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;

  onCommit: (columns: DbColumnRow[]) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};
