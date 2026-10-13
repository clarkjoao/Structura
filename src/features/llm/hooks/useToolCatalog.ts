import { useEffect, useState } from "react";
import { loadInternalTools } from "../tools/load-internal-tools";
import type { ToolKind } from "../tools/registry";

export interface ToolCatalogEntry {
  name: string;
  kind: ToolKind;
}

/** The registered tools by name and kind, for pickers; null while the registry loads. */
export function useToolCatalog(): ToolCatalogEntry[] | null {
  const [tools, setTools] = useState<ToolCatalogEntry[] | null>(null);
  useEffect(() => {
    let active = true;
    void loadInternalTools().then((registry) => {
      if (!active) return;
      setTools(
        registry
          .list()
          .map((tool) => ({ name: tool.name, kind: tool.kind }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
    return () => {
      active = false;
    };
  }, []);
  return tools;
}
