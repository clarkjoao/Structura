/**
 * Tool parameter schemas, derived from the Zod definitions.
 *
 * Generated rather than hand-written, so the schema the model is shown cannot drift from the
 * schema the code validates against. Zod 4 emits JSON Schema natively, so this needs no
 * extra dependency.
 */

import { z } from "zod";
import { architectureIrSchema } from "./schema";

/** JSON Schema draft-7 — what LLM tool APIs expect. */
export function architectureIrJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(architectureIrSchema, { target: "draft-7" }) as Record<string, unknown>;
}

/** Parameter schema for a tool taking `{ ir }`. */
export function proposeArchitectureParameters(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      ir: architectureIrJsonSchema(),
    },
    required: ["ir"],
  };
}
