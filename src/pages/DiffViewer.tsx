import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ReactFlow, Background, BackgroundVariant, Controls,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, GitCompare, Plus, Minus, Pencil, Equal, ChevronDown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useModel } from "@/lib/model-store";
import { computeDiff, type ModelDiffResult, type DiffStatus } from "@/lib/model-diff";
import DiffNode from "@/components/canvas/DiffNode";
import DiffEdge from "@/components/canvas/DiffEdge";

const nodeTypes = { diff: DiffNode };
const edgeTypes = { diff: DiffEdge };

const statusFilters: { key: DiffStatus; label: string; icon: typeof Plus; color: string }[] = [
  { key: "added",     label: "Adicionados", icon: Plus,   color: "text-success" },
  { key: "removed",   label: "Removidos",   icon: Minus,  color: "text-destructive" },
  { key: "modified",  label: "Modificados", icon: Pencil, color: "text-warning" },
  { key: "unchanged", label: "Inalterados", icon: Equal,  color: "text-muted-foreground" },
];

const VersionSelector = ({
  label, value, onChange, versions,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  versions: { id: string; version: string; message: string }[];
}) => (
  <div className="relative">
    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full rounded-md border border-border bg-secondary px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.version} — {v.message}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  </div>
);

const DiffViewer = () => {
  const { versions } = useModel();
  const [baseId, setBaseId] = useState(versions.length > 1 ? versions[1].id : versions[0]?.id ?? "");
  const [targetId, setTargetId] = useState(versions[0]?.id ?? "");
  const [visibleStatuses, setVisibleStatuses] = useState<Set<DiffStatus>>(
    new Set(["added", "removed", "modified", "unchanged"])
  );

  const baseVersion = versions.find((v) => v.id === baseId);
  const targetVersion = versions.find((v) => v.id === targetId);

  const diff: ModelDiffResult | null = useMemo(() => {
    if (!baseVersion || !targetVersion) return null;
    return computeDiff(baseVersion.snapshot, targetVersion.snapshot);
  }, [baseVersion, targetVersion]);

  const toggleFilter = (status: DiffStatus) => {
    setVisibleStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Build nodes from diff — use target snapshot layout, fall back to base
  const nodes: Node[] = useMemo(() => {
    if (!diff || !baseVersion || !targetVersion) return [];
    const targetViews = Object.values(targetVersion.snapshot.views);
    const baseViews = Object.values(baseVersion.snapshot.views);
    // Merge all layouts
    const layoutMap = new Map<string, { x: number; y: number }>();
    for (const v of baseViews) for (const nl of v.nodeLayouts) layoutMap.set(nl.elementId, { x: nl.x, y: nl.y });
    for (const v of targetViews) for (const nl of v.nodeLayouts) layoutMap.set(nl.elementId, { x: nl.x, y: nl.y });

    return Object.values(diff.elements)
      .filter((d) => visibleStatuses.has(d.status))
      .map((d, i) => {
        const pos = layoutMap.get(d.id) ?? { x: 100 + (i % 4) * 280, y: 100 + Math.floor(i / 4) * 200 };
        return {
          id: d.id,
          type: "diff",
          position: pos,
          data: {
            name: d.element.name,
            type: d.element.type,
            description: d.element.description,
            technology: d.element.technology,
            diffStatus: d.status,
            changes: d.changes,
          },
        };
      });
  }, [diff, visibleStatuses, baseVersion, targetVersion]);

  const edges: Edge[] = useMemo(() => {
    if (!diff) return [];
    const visibleNodeIds = new Set(nodes.map((n) => n.id));
    return Object.values(diff.relationships)
      .filter((d) => visibleStatuses.has(d.status))
      .filter((d) => visibleNodeIds.has(d.relationship.sourceId) && visibleNodeIds.has(d.relationship.targetId))
      .map((d) => ({
        id: d.id,
        source: d.relationship.sourceId,
        target: d.relationship.targetId,
        type: "diff",
        data: {
          label: d.relationship.label,
          technology: d.relationship.technology,
          diffStatus: d.status,
        },
      }));
  }, [diff, visibleStatuses, nodes]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/model/1" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <GitCompare className="h-4 w-4 text-primary" />
            <span className="font-semibold">Diff Visual</span>
            {baseVersion && targetVersion && (
              <span className="font-mono text-xs text-muted-foreground">
                {baseVersion.version} → {targetVersion.version}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="border-b border-border bg-card/50 shrink-0">
        <div className="container py-3 flex flex-wrap items-end gap-4">
          <VersionSelector label="Base (antes)" value={baseId} onChange={setBaseId} versions={versions} />
          <div className="flex items-center pb-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
          </div>
          <VersionSelector label="Target (depois)" value={targetId} onChange={setTargetId} versions={versions} />

          {/* Filters */}
          <div className="flex items-end gap-2 ml-auto pb-0.5">
            {statusFilters.map(({ key, label, icon: FilterIcon, color }) => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium border transition-all ${
                  visibleStatuses.has(key)
                    ? `${color} border-current/20 bg-current/5`
                    : "text-muted-foreground/40 border-transparent"
                }`}
              >
                <FilterIcon className="h-3 w-3" />
                {label}
                {diff && (
                  <span className="font-mono ml-0.5">
                    {key === "added" ? diff.summary.elementsAdded + diff.summary.relationshipsAdded :
                     key === "removed" ? diff.summary.elementsRemoved + diff.summary.relationshipsRemoved :
                     key === "modified" ? diff.summary.elementsModified + diff.summary.relationshipsModified :
                     diff.summary.elementsUnchanged + diff.summary.relationshipsUnchanged}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {diff && (
        <div className="border-b border-border bg-card/30 shrink-0">
          <div className="container flex items-center gap-6 py-2 text-xs">
            <span className="text-muted-foreground">Elementos:</span>
            <span className="text-success font-mono">+{diff.summary.elementsAdded}</span>
            <span className="text-destructive font-mono">-{diff.summary.elementsRemoved}</span>
            <span className="text-warning font-mono">~{diff.summary.elementsModified}</span>
            <span className="text-muted-foreground mx-2">|</span>
            <span className="text-muted-foreground">Relacionamentos:</span>
            <span className="text-success font-mono">+{diff.summary.relationshipsAdded}</span>
            <span className="text-destructive font-mono">-{diff.summary.relationshipsRemoved}</span>
            <span className="text-warning font-mono">~{diff.summary.relationshipsModified}</span>
          </div>
        </div>
      )}

      {/* Diff Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 20% 18%)" />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default DiffViewer;
