export type JsonViewerMode = "collapsed" | "expanded" | "editing";

export type JsonViewerNodeData = {
  elementId: string;
  name: string;
  jsonContent: string;
  schemaRef?: string;
  isSelected: boolean;
  layoutWidth: number;
  layoutHeight: number;
  onStartEdit?: () => void;
  onInlineEditingChange?: (editing: boolean) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};
