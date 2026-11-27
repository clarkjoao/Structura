import { kvGetItem, kvSetItem } from "@/infrastructure/persistence/kvStorage";
import { EdgeStyle } from "../enums";

const STORAGE_KEY = "structura:lastEdgeStyle";

const EDGE_STYLES: readonly string[] = Object.values(EdgeStyle);

function isEdgeStyle(value: string | null): value is EdgeStyle {
  return value !== null && EDGE_STYLES.includes(value);
}

export function getLastEdgeStyle(): EdgeStyle {
  try {
    const stored = kvGetItem(STORAGE_KEY);
    if (isEdgeStyle(stored)) return stored;
  } catch (err) {
    console.warn("[edge-style] Failed to read last edge style:", err);
  }
  return EdgeStyle.EditableStep;
}

export function saveLastEdgeStyle(style: EdgeStyle): void {
  try {
    kvSetItem(STORAGE_KEY, style);
  } catch (err) {
    console.warn("[edge-style] Failed to save edge style:", err);
  }
}
