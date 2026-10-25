import { SchemaResolver, bundledSchemaCatalog } from "opscr/core";

/** A spec field opscr requires, with the value a new manifest starts with. */
export interface RequiredField {
  field: string;
  value: string | number | boolean | unknown[];
  /** Picked from the schema's choices, not from the canvas: the user should review it. */
  guessed: boolean;
}

let resolver: SchemaResolver | undefined;

/**
 * The spec fields a Kind's schema requires, each with a value that validates: the first of its
 * choices for an enum, an empty value otherwise. A manifest written from the canvas carries them,
 * so the folder stays valid for every other reader (the CLI, the VSCode preview) — the canvas
 * knows only a name, a description and maybe a provider.
 */
export function requiredFields(kind: string): RequiredField[] {
  resolver ??= new SchemaResolver(bundledSchemaCatalog());
  const apiVersion = resolver.catalog.kindApiVersion.get(kind);
  if (!apiVersion) return [];
  const file = resolver.kindFile(apiVersion, kind);
  if (!resolver.exists(file)) return [];
  const spec = resolver.resolveComponent(file, `${kind}Spec`);
  const required = Array.isArray(spec?.required) ? spec.required.map(String) : [];
  const properties = (spec?.properties ?? {}) as Record<string, Record<string, unknown>>;
  return required.map((field) => {
    const schema = properties[field] ?? {};
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return { field, value: schema.enum[0] as string, guessed: true };
    }
    const type = schema.type;
    if (type === "array") return { field, value: [], guessed: false };
    if (type === "integer" || type === "number") return { field, value: 0, guessed: true };
    if (type === "boolean") return { field, value: false, guessed: true };
    return { field, value: "", guessed: false };
  });
}
