import type { EditorProps } from "@monaco-editor/react";

export type { EditorProps } from "@monaco-editor/react";

/**
 * Stands in for `LazyMonacoEditor` in the embed build (see vite.embed.config.ts): a
 * read-only preview never edits code, and Monaco's ~20 MB of chunks would otherwise ship
 * with every host that packages the preview. Shows the text as it is.
 */
export function LazyMonacoEditor(props: EditorProps) {
  return (
    <pre className="h-full w-full overflow-auto p-2 text-xs">
      {props.value ?? props.defaultValue}
    </pre>
  );
}
