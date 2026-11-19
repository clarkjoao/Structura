import { useState, type ReactNode } from "react";
import { Icon } from "./ui";

const CHEVRON_RIGHT = "m9 18 6-6-6-6";
const FOLDER =
  "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z";
const FILE = [
  "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
  "M14 2v4a2 2 0 0 0 2 2h4",
];

/** A file as the tree shows it: its path, and what to mark it with. */
export interface TreeFile {
  name: string;
  dirty: boolean;
  conflict: boolean;
  /** opscr errors in it. */
  errors: number;
}

interface Folder {
  path: string;
  name: string;
  folders: Folder[];
  files: TreeFile[];
}

/** The paths as nested folders, folders first, each level sorted. */
function treeOf(files: readonly TreeFile[]): Folder {
  const root: Folder = { path: "", name: "", folders: [], files: [] };
  for (const file of files) {
    const parts = file.name.split("/");
    let at = root;
    for (const part of parts.slice(0, -1)) {
      const path = at.path ? `${at.path}/${part}` : part;
      let next = at.folders.find((f) => f.path === path);
      if (!next) at.folders.push((next = { path, name: part, folders: [], files: [] }));
      at = next;
    }
    at.files.push(file);
  }
  const sort = (folder: Folder) => {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name));
    folder.files.sort((a, b) => a.name.localeCompare(b.name));
    folder.folders.forEach(sort);
  };
  sort(root);
  return root;
}

const baseName = (name: string) => name.slice(name.lastIndexOf("/") + 1);

/**
 * The folder's files as a tree, like an editor's explorer: sub-folders (an initiative) fold, the
 * open file is marked, and each file says whether it is unsaved, in conflict or has errors.
 */
export function FileTree({
  files,
  selected,
  onSelect,
  label,
}: {
  files: readonly TreeFile[];
  selected: string | null;
  onSelect: (name: string) => void;
  label: string;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string) =>
    setClosed((now) => {
      const next = new Set(now);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderFolder = (folder: Folder, depth: number): ReactNode[] => [
    ...folder.folders.flatMap((sub) => {
      const open = !closed.has(sub.path);
      return [
        <li key={`dir:${sub.path}`}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => toggle(sub.path)}
            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            <Icon
              path={CHEVRON_RIGHT}
              className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            <Icon path={FOLDER} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{sub.name}</span>
          </button>
        </li>,
        ...(open ? renderFolder(sub, depth + 1) : []),
      ];
    }),
    ...folder.files.map((file) => {
      const active = file.name === selected;
      return (
        <li key={file.name}>
          <button
            type="button"
            aria-current={active ? "true" : undefined}
            title={file.name}
            onClick={() => onSelect(file.name)}
            className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs ${
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-foreground/90 hover:bg-accent/40"
            }`}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
          >
            <Icon path={FILE} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{baseName(file.name)}</span>
            {file.errors > 0 && (
              <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 text-[10px] text-destructive">
                {file.errors}
              </span>
            )}
            {file.conflict ? (
              <span className="shrink-0 text-amber-600" aria-hidden>
                ⚠
              </span>
            ) : file.dirty ? (
              <span className="shrink-0 text-muted-foreground" aria-hidden>
                •
              </span>
            ) : null}
          </button>
        </li>
      );
    }),
  ];

  return (
    <ul aria-label={label} className="space-y-px px-2 py-1.5">
      {renderFolder(treeOf(files), 0)}
    </ul>
  );
}
