import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * An object, drawn the way a debugger draws one.
 *
 * It knows nothing about flows or steps — it takes parsed JSON and renders it —
 * so the script panel can reuse it for editing payloads without anything being
 * pulled apart first.
 */

interface Props {
  value: unknown;
  /** Nodes at or below this depth start open. Deeper ones start collapsed. */
  openToDepth?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What a collapsed node says about itself, so folding loses no information. */
function useSummary() {
  const { t } = useTranslation();
  return (value: unknown): string => {
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (isRecord(value)) {
      return `{ ${t("flowReading.fields", { count: Object.keys(value).length })} }`;
    }
    return "";
  };
}

const Leaf = ({ value }: { value: unknown }) => {
  if (typeof value === "string") {
    return <span className="text-json-string">&quot;{value}&quot;</span>;
  }
  if (typeof value === "number") return <span className="text-json-number">{String(value)}</span>;
  if (typeof value === "boolean" || value === null) {
    return <span className="text-json-boolean">{String(value)}</span>;
  }
  return <span className="text-muted-foreground">{String(value)}</span>;
};

interface NodeProps {
  label: string | null;
  value: unknown;
  depth: number;
  openToDepth: number;
}

const Node = ({ label, value, depth, openToDepth }: NodeProps) => {
  const summarise = useSummary();
  const nested = Array.isArray(value) || isRecord(value);
  const [open, setOpen] = useState(depth < openToDepth);

  if (!nested) {
    return (
      <div data-testid="json-line" className="py-px">
        {label !== null && (
          <>
            <span className="text-json-key">{label}</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <Leaf value={value} />
      </div>
    );
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);

  return (
    <div data-testid="json-line" className="py-px">
      <button
        type="button"
        data-testid="json-toggle"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex items-baseline gap-1.5 text-left transition-colors hover:text-foreground"
      >
        <span className="w-2 shrink-0 text-[9px] text-muted-foreground">{open ? "▾" : "▸"}</span>
        {label !== null && <span className="text-json-key">{label}</span>}
        <span className="text-muted-foreground">{open ? "" : summarise(value)}</span>
      </button>
      {open && (
        <div className="ml-[5px] border-l border-border pl-3">
          {entries.map(([key, child]) => (
            <Node key={key} label={key} value={child} depth={depth + 1} openToDepth={openToDepth} />
          ))}
        </div>
      )}
    </div>
  );
};

const JsonTree = ({ value, openToDepth = 2 }: Props) => (
  <div data-testid="json-tree" className="font-mono text-[11.5px] leading-[1.5]">
    {Array.isArray(value) || isRecord(value) ? (
      (Array.isArray(value)
        ? value.map((item, index) => [String(index), item] as [string, unknown])
        : Object.entries(value as Record<string, unknown>)
      ).map(([key, child]) => (
        <Node key={key} label={key} value={child} depth={1} openToDepth={openToDepth} />
      ))
    ) : (
      <Node label={null} value={value} depth={1} openToDepth={openToDepth} />
    )}
  </div>
);

export default JsonTree;
