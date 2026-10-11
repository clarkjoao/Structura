import { Suspense, lazy } from "react";
import type { DiffEditorProps, EditorProps } from "@monaco-editor/react";

export type { DiffEditorProps, EditorProps } from "@monaco-editor/react";

/**
 * Monaco is ~3.5MB and was previously wired up eagerly in main.tsx, putting it
 * in the initial bundle for every visitor. This wrapper defers both the editor
 * component and the bundled monaco runtime (we bundle instead of using the
 * default CDN loader so the app works offline) until an editor is rendered.
 */
/**
 * Monaco cancels work it started for a model when the editor moves to another one, and some of
 * those cancellations reject a promise nobody awaits. They mean nothing went wrong; Monaco's own
 * docs ignore them the same way.
 */
let ignoringCancellations = false;
function ignoreMonacoCancellations() {
  if (ignoringCancellations) return;
  ignoringCancellations = true;
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    if (reason instanceof Error && reason.name === "Canceled" && reason.message === "Canceled") {
      event.preventDefault();
    }
  });
}

const loadMonaco = async () => {
  ignoreMonacoCancellations();
  const [react, monaco] = await Promise.all([
    import("@monaco-editor/react"),
    import("monaco-editor"),
  ]);
  react.loader.config({ monaco });
  return react;
};
const Editor = lazy(async () => ({ default: (await loadMonaco()).default }));
const DiffEditor = lazy(async () => ({ default: (await loadMonaco()).DiffEditor }));

const fallback = (
  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
    …
  </div>
);

export function LazyMonacoEditor(props: EditorProps) {
  return (
    <Suspense fallback={fallback}>
      <Editor {...props} />
    </Suspense>
  );
}

/** Monaco's side-by-side diff, loaded the same way. */
export function LazyMonacoDiffEditor(props: DiffEditorProps) {
  return (
    <Suspense fallback={fallback}>
      <DiffEditor {...props} />
    </Suspense>
  );
}
