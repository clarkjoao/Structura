import { Suspense, lazy } from "react";
import type { EditorProps } from "@monaco-editor/react";

export type { EditorProps } from "@monaco-editor/react";

/**
 * Monaco is ~3.5MB and was previously wired up eagerly in main.tsx, putting it
 * in the initial bundle for every visitor. This wrapper defers both the editor
 * component and the bundled monaco runtime (we bundle instead of using the
 * default CDN loader so the app works offline) until an editor is rendered.
 */
const Editor = lazy(async () => {
  const [{ default: MonacoEditor, loader }, monaco] = await Promise.all([
    import("@monaco-editor/react"),
    import("monaco-editor"),
  ]);
  loader.config({ monaco });
  return { default: MonacoEditor };
});

export function LazyMonacoEditor(props: EditorProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          …
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
