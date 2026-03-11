import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Database, Network, Search, Server, Square, StickyNote, Star, User, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramActions, useAllServices, useAllComponents } from "@/features/diagram";
import type { ComponentType } from "@/features/diagram";
import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/aws-catalog";
import AwsIcon from "../nodes/AwsIcon";
import { trackUsage, getTopUsed } from "./element-usage-tracker";

const C4_OPTIONS: { type: ComponentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "person", label: "Person", icon: User },
  { type: "system", label: "System", icon: Network },
  { type: "container", label: "Container", icon: Server },
  { type: "component", label: "Component", icon: Database },
];

const CANVAS_OPTIONS: { type: ComponentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "panel", label: "Panel", icon: Square },
  { type: "note", label: "Note", icon: StickyNote },
];

interface ElementPickerModalProps {
  onClose: () => void;
  onInsert?: (nodeId: string) => void;
}

const ElementPickerModal = ({ onClose, onInsert }: ElementPickerModalProps) => {
  const [search, setSearch] = useState("");
  const [expandedAwsCats, setExpandedAwsCats] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useReactFlow();
  const { addComponent, linkComponentToService } = useDiagramActions();
  const services = useAllServices();
  const allComponents = useAllComponents();

  const onCanvasServiceIds = useMemo(
    () => new Set(allComponents.map((c) => c.serviceId).filter((id): id is string => !!id)),
    [allComponents],
  );

  const topUsed = useMemo(() => getTopUsed(8), []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const q = search.trim().toLowerCase();

  const filteredC4 = useMemo(
    () => (q ? C4_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : C4_OPTIONS),
    [q],
  );

  const filteredCanvas = useMemo(
    () => (q ? CANVAS_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : CANVAS_OPTIONS),
    [q],
  );

  const filteredAwsCategories = useMemo(() => {
    if (!q) return AWS_CATEGORIES;
    return AWS_CATEGORIES.map((cat) => ({
      ...cat,
      services: cat.services.filter((s) => s.name.toLowerCase().includes(q)),
    })).filter((cat) => cat.services.length > 0);
  }, [q]);

  const filteredServices = useMemo(() => {
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [q, services]);

  const getInsertPos = useCallback(
    () => rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [rfInstance],
  );

  const handleAddElement = (type: ComponentType, label: string) => {
    const key = type === "panel" || type === "note" ? `canvas:${type}` : `c4:${type}`;
    trackUsage(key);
    const name = type === "note" ? "" : `Novo ${label}`;
    const comp = addComponent(type, name, null, getInsertPos());
    onInsert?.(comp.id);
    onClose();
  };

  const handleAddAws = (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => {
    trackUsage(`aws:${serviceId}`);
    const comp = addComponent(categoryId, serviceName, null, getInsertPos(), serviceId);
    onInsert?.(comp.id);
    onClose();
  };

  const handleAddService = (serviceId: string, name: string) => {
    trackUsage(`registry:${serviceId}`);
    const comp = addComponent("system", name, null, getInsertPos());
    linkComponentToService(comp.id, serviceId);
    onInsert?.(comp.id);
    onClose();
  };

  const toggleAwsCat = (catId: string) => {
    setExpandedAwsCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Build "frequently used" items from tracked data
  const frequentItems = useMemo(() => {
    if (q) return []; // hide when searching
    const allAwsServices = AWS_CATEGORIES.flatMap((cat) =>
      cat.services.map((svc) => ({ ...svc, categoryId: cat.id })),
    );
    return topUsed
      .map((entry) => {
        const [prefix, id] = entry.key.split(":");
        if (prefix === "c4") {
          const opt = C4_OPTIONS.find((o) => o.type === id);
          if (opt) return { kind: "c4" as const, opt, entry };
        }
        if (prefix === "canvas") {
          const opt = CANVAS_OPTIONS.find((o) => o.type === id);
          if (opt) return { kind: "canvas" as const, opt, entry };
        }
        if (prefix === "aws") {
          const svc = allAwsServices.find((s) => s.id === id);
          if (svc) return { kind: "aws" as const, svc, entry };
        }
        if (prefix === "registry") {
          const svc = services.find((s) => s.id === id);
          if (svc) return { kind: "registry" as const, svc, entry };
        }
        return null;
      })
      .filter(Boolean);
  }, [topUsed, q, services]);

  const showC4 = filteredC4.length > 0;
  const showCanvas = filteredCanvas.length > 0;
  const showAws = filteredAwsCategories.length > 0;
  const showRegistry = services.length > 0 && filteredServices.length > 0;
  const showFrequent = frequentItems.length > 0;
  const showEmpty = !!q && !showC4 && !showCanvas && !showAws && !showRegistry;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col bg-card border border-border rounded-xl shadow-2xl w-[560px] max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">Add Element</h2>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elements and registry..."
              className="w-full rounded-md border border-border bg-secondary py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {showEmpty && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No results for &ldquo;{search.trim()}&rdquo;
            </p>
          )}

          {/* FREQUENTLY USED */}
          {showFrequent && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                <Star className="h-3 w-3" /> Frequently Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {frequentItems.map((item) => {
                  if (!item) return null;
                  if (item.kind === "c4") {
                    const { opt } = item;
                    return (
                      <button
                        key={`freq-c4-${opt.type}`}
                        onClick={() => handleAddElement(opt.type, opt.label)}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                      >
                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {opt.label}
                      </button>
                    );
                  }
                  if (item.kind === "canvas") {
                    const { opt } = item;
                    return (
                      <button
                        key={`freq-canvas-${opt.type}`}
                        onClick={() => handleAddElement(opt.type, opt.label)}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                      >
                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {opt.label}
                      </button>
                    );
                  }
                  if (item.kind === "aws") {
                    const { svc } = item;
                    return (
                      <button
                        key={`freq-aws-${svc.id}`}
                        onClick={() => handleAddAws(svc.categoryId as AwsCategoryId, svc.id, svc.name)}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                      >
                        <AwsIcon iconName={svc.iconName} size={14} />
                        <span className="max-w-[100px] truncate">{svc.name.replace(/^Amazon |^AWS /, "")}</span>
                      </button>
                    );
                  }
                  if (item.kind === "registry") {
                    const { svc } = item;
                    return (
                      <button
                        key={`freq-reg-${svc.id}`}
                        onClick={() => handleAddService(svc.id, svc.name)}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                      >
                        {svc.name}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            </section>
          )}

          {/* C4 MODEL */}
          {showC4 && (
            <section>
              <p className="mb-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                C4 Model
              </p>
              <div className="grid grid-cols-4 gap-2">
                {filteredC4.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handleAddElement(opt.type, opt.label)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                  >
                    <opt.icon className="h-5 w-5 text-muted-foreground" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* CANVAS */}
          {showCanvas && (
            <section>
              <p className="mb-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                Canvas
              </p>
              <div className="flex gap-2">
                {filteredCanvas.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handleAddElement(opt.type, opt.label)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-secondary px-4 py-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                  >
                    <opt.icon className="h-5 w-5 text-muted-foreground" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* AWS SERVICES — collapsible categories */}
          {showAws && (
            <section>
              <p className="mb-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                AWS Services
              </p>
              <div className="space-y-0.5">
                {filteredAwsCategories.map((cat) => {
                  const isExpanded = expandedAwsCats.has(cat.id) || !!q;
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => toggleAwsCat(cat.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                      >
                        <ChevronRight
                          className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                        <span>{cat.name}</span>
                        <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                          {cat.services.length}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="flex flex-wrap gap-1.5 pb-2 pl-6 pt-1">
                          {cat.services.map((svc) => (
                            <button
                              key={svc.id}
                              onClick={() => handleAddAws(cat.id as AwsCategoryId, svc.id, svc.name)}
                              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-surface-hover"
                            >
                              <AwsIcon iconName={svc.iconName} size={16} />
                              <span className="max-w-[100px] truncate">
                                {svc.name.replace(/^Amazon |^AWS /, "")}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* REGISTRY */}
          {showRegistry && (
            <section>
              <p className="mb-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                Registry
              </p>
              <div className="space-y-1">
                {filteredServices.map((svc) => {
                  const isOnCanvas = onCanvasServiceIds.has(svc.id);
                  return (
                    <div
                      key={svc.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{svc.name}</p>
                        {svc.technology.length > 0 && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {svc.technology.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </div>
                      {isOnCanvas ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-400">
                          <Check className="h-3 w-3" /> On canvas
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddService(svc.id, svc.name)}
                          className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElementPickerModal;
