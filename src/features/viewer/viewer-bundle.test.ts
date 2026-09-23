import { describe, expect, it } from "vitest";
import { runtimeImportsOf } from "@/test/runtime-imports";

/**
 * A shared link must not download the editor.
 *
 * `/viewer` is a lazy route, but what the entry imports statically loads on
 * every route. One re-export — `CollabRoom` from the collaboration barrel —
 * pulled the whole editor into that entry, the canvas barrel and the LLM chat
 * with it: measured 2026-09-22, `/viewer` fetched 870 KB of script, 173 KB of
 * it editor it never mounts. Two paths led there (an element descriptor's
 * inspector panel, and `EditableEdge`'s collab highlight), both through that
 * barrel. `App.tsx` already imports `CollabRoom` lazily by its own path.
 *
 * These are the modules a reader never runs; nothing the reader loads may
 * reach them statically.
 */
const EDITOR_ONLY = [
  "src/features/canvas/Canvas.tsx",
  "src/features/collaboration/components/CollabRoom.tsx",
  "src/features/llm/components/AssistantUIChatPanel.tsx",
];

describe("what a reader loads", () => {
  for (const entry of ["src/main.tsx", "src/pages/ViewerPage.tsx"]) {
    it(`${entry} does not reach the editor`, () => {
      const reached = new Set(runtimeImportsOf(entry));
      expect(EDITOR_ONLY.filter((module) => reached.has(module))).toEqual([]);
    });
  }
});
