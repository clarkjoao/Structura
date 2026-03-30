export type JsonViewerMode = "collapsed" | "expanded" | "editing";

export interface JsonViewerNodeData {
  elementId: string;
  name: string;
  jsonContent: string;
  schemaRef?: string;
  isSelected: boolean;
  layoutWidth: number;
  layoutHeight: number;
  /** Injected by descriptor — stub replaced by the node so double-click starts inline edit */
  onStartEdit?: () => void;
  onInlineEditingChange?: (editing: boolean) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
}
