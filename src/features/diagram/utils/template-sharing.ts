import type { UserTemplate } from "../model/diagram.types";
import { generateId } from "./generate-id";

const TEMPLATE_FILE_MAGIC = "structura-template-v1";

export interface TemplateExportEnvelope {
  _magic: typeof TEMPLATE_FILE_MAGIC;
  exportedAt: number;
  template: UserTemplate;
}

/** Serializes a UserTemplate for download. Import assigns a new id to avoid collisions. */
export function exportTemplateToJson(template: UserTemplate): string {
  const envelope: TemplateExportEnvelope = {
    _magic: TEMPLATE_FILE_MAGIC,
    exportedAt: Date.now(),
    template,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Triggers a browser download of the template JSON file. */
export function downloadTemplate(template: UserTemplate): void {
  const json = exportTemplateToJson(template);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = template.name
    .replace(/[^a-z0-9\-_\s]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
  link.download = `${safeName || "template"}.structura-template.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export type ImportTemplateResult =
  | { ok: true; template: UserTemplate }
  | { ok: false; error: "invalid_format" | "parse_error" };

/** Parses and validates a template file; assigns a new id on success. */
export async function importTemplateFromFile(
  file: File,
): Promise<ImportTemplateResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<TemplateExportEnvelope>;

    if (parsed._magic !== TEMPLATE_FILE_MAGIC) {
      return { ok: false, error: "invalid_format" };
    }

    const t = parsed.template;
    if (
      !t ||
      typeof t.id !== "string" ||
      typeof t.name !== "string" ||
      !Array.isArray(t.components) ||
      !Array.isArray(t.connections)
    ) {
      return { ok: false, error: "invalid_format" };
    }

    const imported: UserTemplate = {
      ...t,
      id: generateId("tpl"),
      createdAt: Date.now(),
    };

    return { ok: true, template: imported };
  } catch {
    return { ok: false, error: "parse_error" };
  }
}
