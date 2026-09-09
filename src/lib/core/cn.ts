import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

/**
 * Merge tailwind class names with clsx — handles conflicts intelligently.
 * Single source of truth for all class merging in the app.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
