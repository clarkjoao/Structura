import { ElementCategory } from "../../enums";
import { LAST_CATEGORY_KEY } from "./constants";

export function readStoredCategory(): ElementCategory {
  try {
    const v = localStorage.getItem(LAST_CATEGORY_KEY);
    const valid = Object.values(ElementCategory).includes(v as ElementCategory);
    if (valid) return v as ElementCategory;
  } catch {
    /* ignore */
  }
  return ElementCategory.All;
}

export function persistCategory(cat: ElementCategory) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, cat);
  } catch {
    /* ignore */
  }
}
