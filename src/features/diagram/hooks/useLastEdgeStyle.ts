import type { EdgeStyle } from "../model/connection.types";

const STORAGE_KEY = "structura:lastEdgeStyle";
const DEFAULT_STYLE: EdgeStyle = "smoothstep";

function isEdgeStyle(value: string | null): value is EdgeStyle {
  return (
    value === "straight" ||
    value === "bezier" ||
    value === "step" ||
    value === "smoothstep"
  );
}

export function getLastEdgeStyle(): EdgeStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isEdgeStyle(stored)) return stored;
  } catch {
    // noop
  }
  return DEFAULT_STYLE;
}

export function saveLastEdgeStyle(style: EdgeStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // noop
  }
}
