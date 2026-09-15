import { ElementCategory, type PickerCategoryId } from "../../enums";
import { LAST_CATEGORY_KEY } from "./constants";
import { isRegisteredCloudFamily } from "@/features/elements/families/cloud-family.registry";

function isFixedCategory(value: string): value is ElementCategory {
  return (Object.values(ElementCategory) as string[]).includes(value);
}

export function readStoredCategory(): PickerCategoryId {
  try {
    const v = localStorage.getItem(LAST_CATEGORY_KEY);
    if (!v) return ElementCategory.All;
    if (isFixedCategory(v) || isRegisteredCloudFamily(v)) return v;
  } catch (error) {
    console.warn("[StructuraContext] element picker readStoredCategory", error);
  }
  return ElementCategory.All;
}

export function persistCategory(cat: PickerCategoryId) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, cat);
  } catch (error) {
    console.warn("[StructuraContext] element picker persistCategory", error);
  }
}
