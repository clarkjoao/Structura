import { EdgeStyle } from "../enums";

const STORAGE_KEY = "structura:lastEdgeStyle";

function isEdgeStyle(value: string | null): value is EdgeStyle {
  return (
    value === EdgeStyle.Straight ||
    value === EdgeStyle.Bezier ||
    value === EdgeStyle.Step ||
    value === EdgeStyle.Smoothstep
  );
}

export function getLastEdgeStyle(): EdgeStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isEdgeStyle(stored)) return stored;
  } catch (err) {
    console.warn("[useLastEdgeStyle] Failed to read last edge style:", err);
  }
  return EdgeStyle.Smoothstep;
}

export function saveLastEdgeStyle(style: EdgeStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch (err) {
    console.warn("[useLastEdgeStyle] Failed to save edge style:", err);
  }
}
