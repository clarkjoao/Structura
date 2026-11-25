import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, GripVertical, Link2, LocateFixed, Box, Plus, Search } from "lucide-react";
import { getElement } from "@/features/elements/element.registry";
import {
  useConnections,
  useComponents,
  useComponent,
  useDiagramActions,
  useResolvedNodeLayouts,
  applyHandleOrder,
} from "@/features/diagram";
import { refsOf, sharedMode } from "@/features/diagram/utils/shared";
import { HandleSide } from "@/features/canvas/enums";
import type { Component, ComponentType, Connection } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { useSharedRevealStore } from "@/features/canvas/shared/useSharedRevealStore";
import { useHandleHighlight } from "../../../contexts/HandleHighlightContext";

/** The other end's icon: its element's, as the panel header and the catalog show it. */
function NodeIcon({ type }: { type: ComponentType }) {
  const icon = getElement(type)?.palette.icon;
  const Icon = icon?.kind === "lucide" ? icon.icon : Box;
  return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

type Side = "incoming" | "outgoing";

interface DragState {
  connId: string;
  side: Side;
}

/** One line of the tab: a connection, seen from this element, maybe arriving at a reference. */
interface Row {
  conn: Connection;
  /** The other end. */
  peerId: string;
  /** Set when the connection meets one of this element's references, not the element itself. */
  viaRef?: { id: string; index: number };
}

const SECTION_TITLE = "flex items-baseline gap-1.5 px-0.5 text-xs font-semibold text-foreground";
const COUNT = "text-[11px] font-normal tabular-nums text-muted-foreground";

interface GroupProps {
  label: string;
  rows: Row[];
  side: Side;
  /** Reordering moves the element's own handles: off while searching. */
  reorderable: boolean;
  dragState: DragState | null;
  dragOverId: string | null;
  /** null = all connections highlighted (default). */
  focusedConnId: string | null;
  onDragStart: (connId: string, side: Side) => void;
  onDragOver: (e: React.DragEvent, connId: string, side: Side) => void;
  onDrop: (e: React.DragEvent, targetConnId: string, side: Side) => void;
  onDragEnd: () => void;
  onConnClick: (connId: string) => void;
  onFocusElement?: (componentId: string) => void;
  /** A control at the end of the section's title (the first section holds "Highlight all"). */
  action?: React.ReactNode;
}

function ConnectionGroup({
  action,
  label,
  rows,
  side,
  reorderable,
  dragState,
  dragOverId,
  focusedConnId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onConnClick,
  onFocusElement,
}: GroupProps) {
  const { t } = useTranslation();
  const components = useComponents();
  const narrowing = focusedConnId !== null;

  if (rows.length === 0) return null;

  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>
          {label} <span className={COUNT}>{rows.length}</span>
        </h3>
        {action}
      </div>
      <ul className="space-y-px">
        {rows.map(({ conn, peerId, viaRef }) => {
          const peer = components[peerId];
          // A connection that meets a reference has no handle of this element to reorder.
          const draggable = reorderable && !viaRef;
          const isDragging = dragState?.connId === conn.id && dragState.side === side;
          const isOver =
            dragOverId === conn.id && dragState?.side === side && dragState.connId !== conn.id;
          const focused = focusedConnId === conn.id;
          const dimmed = narrowing && !focused;

          return (
            <li
              key={conn.id}
              draggable={draggable}
              onDragStart={(e) => {
                if (!draggable) return;
                e.dataTransfer.effectAllowed = "move";
                onDragStart(conn.id, side);
              }}
              onDragOver={(e) => draggable && onDragOver(e, conn.id, side)}
              onDrop={(e) => draggable && onDrop(e, conn.id, side)}
              onDragEnd={onDragEnd}
              onClick={() => onConnClick(conn.id)}
              className={cn(
                "group relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-1 pr-1.5 text-sm transition-[background-color,opacity] duration-150",
                focused ? "bg-primary/10" : "hover:bg-accent",
                (isDragging || dimmed) && "opacity-40 hover:opacity-70",
                isOver && "shadow-[inset_0_2px_0_hsl(var(--primary))]",
              )}
            >
              <GripVertical
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/40",
                  draggable ? "cursor-grab group-hover:text-muted-foreground" : "invisible",
                )}
              />
              {peer ? <NodeIcon type={peer.type} /> : <span className="w-3.5" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{peer?.name ?? "?"}</span>
                {viaRef && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                    {t("connectionsTab.viaRef", { index: viaRef.index })}
                  </span>
                )}
              </span>
              {conn.label && (
                <span className="max-w-[38%] shrink-0 truncate text-xs text-muted-foreground">
                  {conn.label}
                </span>
              )}
              {onFocusElement && peer && (
                <button
                  type="button"
                  title={t("connectionsTab.goTo", { name: peer.name })}
                  aria-label={t("connectionsTab.goTo", { name: peer.name })}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFocusElement(peerId);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Where else the element is drawn: its references, and making one more. */
function ReferencesSection({
  component,
  refIds,
  canCreate,
  revealCount,
  onFocusElement,
}: {
  component: Component;
  refIds: string[];
  canCreate: boolean;
  /** Edges a badge-mode element hides; 0 hides the toggle. */
  revealCount: number;
  onFocusElement?: (componentId: string) => void;
}) {
  const { t } = useTranslation();
  const layouts = useResolvedNodeLayouts();
  const { addSharedRef } = useDiagramActions();
  const revealed = useSharedRevealStore((state) => state.originals.has(component.id));
  const toggleReveal = useSharedRevealStore((state) => state.toggleOriginal);

  const createRef = () => {
    const at = layouts[component.id];
    addSharedRef(
      component.id,
      component.parentId,
      at ? { x: at.x + (at.width ?? 200) + 40, y: at.y } : { x: 0, y: 0 },
    );
  };

  return (
    <section className="space-y-1 border-t border-border pt-3" data-testid="connections-references">
      <h3 className={SECTION_TITLE}>
        {t("connectionsTab.drawnElsewhere")}
        {refIds.length > 0 && <span className={COUNT}>{refIds.length}</span>}
      </h3>
      {refIds.length === 0 && (
        <p className="px-0.5 text-xs text-muted-foreground">{t("shared.menu.intro")}</p>
      )}
      <ul className="space-y-px">
        {refIds.map((refId, index) => (
          <li key={refId}>
            <button
              type="button"
              disabled={!onFocusElement}
              onClick={() => onFocusElement?.(refId)}
              className="flex w-full items-center gap-2 rounded-md py-1.5 pl-[1.625rem] pr-1.5 text-left text-sm text-foreground enabled:hover:bg-accent"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {t("shared.menu.refRow", { name: component.name, index: index + 1 })}
              </span>
              <LocateFixed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {revealCount > 0 && (
        <button
          type="button"
          aria-pressed={revealed}
          onClick={() => toggleReveal(component.id)}
          className="flex w-full items-center gap-2 rounded-md py-1.5 pl-[1.625rem] pr-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {revealed ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          {revealed
            ? t("shared.hideEdges", { count: revealCount })
            : t("shared.showEdges", { count: revealCount })}
        </button>
      )}
      {canCreate && (
        <button
          type="button"
          onClick={createRef}
          title={t("shared.menu.createHint")}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-border py-1.5 pl-[1.625rem] pr-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("shared.menu.create")}
        </button>
      )}
    </section>
  );
}

function nodeIdsForConnections(
  connectionIds: readonly string[],
  connections: Record<string, Connection>,
): string[] {
  const nodeIds = new Set<string>();
  for (const id of connectionIds) {
    const connection = connections[id];
    if (!connection) continue;
    nodeIds.add(connection.sourceId);
    nodeIds.add(connection.targetId);
  }
  return [...nodeIds];
}

export interface ConnectionsTabProps {
  componentId: string;
  /**
   * The element can be drawn again elsewhere (references allowed in this diagram): the tab then
   * shows its references, and connections that reach it through them.
   */
  references?: { canCreate: boolean };
  onFocusElement?: (componentId: string) => void;
}

/**
 * Who this element talks to, in one place: what comes in, what goes out — through the element
 * or any of its references — and where else it is drawn. Rows name the other end only; the
 * element itself is the panel's title.
 */
const ConnectionsTab = ({ componentId, references, onFocusElement }: ConnectionsTabProps) => {
  const { t } = useTranslation();
  const connections = useConnections();
  const components = useComponents();
  const component = useComponent(componentId);
  const { updateHandleOrder } = useDiagramActions();
  const [search, setSearch] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  /** null = all connections of this node are highlighted. */
  const [focusedConnId, setFocusedConnId] = useState<string | null>(null);
  const { highlightedConnectionIds, setHighlight, clearHighlight } = useHandleHighlight();

  const refIds = useMemo(
    () => (references ? refsOf(componentId, components) : []),
    [references, componentId, components],
  );

  const { incoming, outgoing } = useMemo(() => {
    const allConns = Object.values(connections);
    const refIndex = new Map(refIds.map((id, index) => [id, index + 1]));
    const viaRef = (id: string) => {
      const index = refIndex.get(id);
      return index === undefined ? undefined : { id, index };
    };
    const directIn = applyHandleOrder(
      allConns.filter((c) => c.targetId === componentId),
      component?.handleOrder?.incoming ?? [],
    );
    const directOut = applyHandleOrder(
      allConns.filter((c) => c.sourceId === componentId),
      component?.handleOrder?.outgoing ?? [],
    );
    const throughRefsIn = allConns.filter((c) => refIndex.has(c.targetId));
    const throughRefsOut = allConns.filter((c) => refIndex.has(c.sourceId));
    return {
      incoming: [
        ...directIn.map((conn): Row => ({ conn, peerId: conn.sourceId })),
        ...throughRefsIn.map((conn): Row => ({
          conn,
          peerId: conn.sourceId,
          viaRef: viaRef(conn.targetId),
        })),
      ],
      outgoing: [
        ...directOut.map((conn): Row => ({ conn, peerId: conn.targetId })),
        ...throughRefsOut.map((conn): Row => ({
          conn,
          peerId: conn.targetId,
          viaRef: viaRef(conn.sourceId),
        })),
      ],
    };
  }, [connections, componentId, component?.handleOrder, refIds]);

  const allConnectionIds = useMemo(
    () => [...incoming, ...outgoing].map((row) => row.conn.id),
    [incoming, outgoing],
  );
  const allConnectionIdsKey = allConnectionIds.join("\0");
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const allConnectionIdsRef = useRef(allConnectionIds);
  allConnectionIdsRef.current = allConnectionIds;

  const highlightAll = useCallback(() => {
    setFocusedConnId(null);
    const ids = allConnectionIdsRef.current;
    if (ids.length === 0) {
      clearHighlight();
      return;
    }
    setHighlight(ids, nodeIdsForConnections(ids, connectionsRef.current));
  }, [clearHighlight, setHighlight]);

  const query = search.trim().toLowerCase();
  const matches = useCallback(
    (row: Row) =>
      !query ||
      row.conn.label.toLowerCase().includes(query) ||
      (components[row.peerId]?.name ?? "").toLowerCase().includes(query),
    [query, components],
  );
  const shownIncoming = useMemo(() => incoming.filter(matches), [incoming, matches]);
  const shownOutgoing = useMemo(() => outgoing.filter(matches), [outgoing, matches]);

  // Default: all connections highlighted. Re-run when the node or its I/O set changes.
  useEffect(() => {
    setFocusedConnId(null);
    const ids = allConnectionIdsRef.current;
    if (ids.length === 0) {
      clearHighlight();
    } else {
      setHighlight(ids, nodeIdsForConnections(ids, connectionsRef.current));
    }
    return () => clearHighlight();
  }, [allConnectionIdsKey, clearHighlight, componentId, setHighlight]);

  useEffect(() => {
    if (highlightedConnectionIds.size === 0 && focusedConnId !== null) {
      setFocusedConnId(null);
    }
  }, [focusedConnId, highlightedConnectionIds]);

  const handleConnClick = (connId: string) => {
    setFocusedConnId(connId);
    const connection = connectionsRef.current[connId];
    if (!connection) return;
    setHighlight(connId, [connection.sourceId, connection.targetId]);
  };

  const handleDragStart = (connId: string, side: Side) => {
    setDragState({ connId, side });
  };

  const handleDragOver = (e: React.DragEvent, connId: string, side: Side) => {
    if (dragState?.side !== side) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(connId);
  };

  const handleDrop = (e: React.DragEvent, targetConnId: string, side: Side) => {
    e.preventDefault();
    if (!dragState || dragState.side !== side) return;
    // Only the element's own connections have handles to order.
    const list = (side === HandleSide.Incoming ? incoming : outgoing)
      .filter((row) => !row.viaRef)
      .map((row) => row.conn.id);
    const oldIdx = list.indexOf(dragState.connId);
    const newIdx = list.indexOf(targetConnId);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) {
      setDragState(null);
      setDragOverId(null);
      return;
    }
    const newOrder = [...list];
    newOrder.splice(oldIdx, 1);
    newOrder.splice(newIdx, 0, dragState.connId);
    updateHandleOrder(componentId, side, newOrder);
    setDragState(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDragOverId(null);
  };

  const totalCount = incoming.length + outgoing.length;
  const selectAllPressed = focusedConnId === null && totalCount > 0;
  const isSearching = query.length > 0;
  const canReorder =
    !isSearching &&
    (incoming.filter((row) => !row.viaRef).length > 1 ||
      outgoing.filter((row) => !row.viaRef).length > 1);
  // A badge-mode element hides the edges that reach it; the toggle draws them back.
  const revealCount = component && sharedMode(component) === "badge" ? incoming.length : 0;

  const referencesSection = references && component && (
    <ReferencesSection
      component={component}
      refIds={refIds}
      canCreate={references.canCreate}
      revealCount={revealCount}
      onFocusElement={onFocusElement}
    />
  );

  if (totalCount === 0) {
    return (
      <div className="space-y-3 p-3">
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("connectionsTab.noneFound")}
        </p>
        {referencesSection}
      </div>
    );
  }

  const highlightAllButton = totalCount > 1 && (
    <button
      type="button"
      data-testid="connections-select-all"
      aria-pressed={selectAllPressed}
      aria-label={t("connectionsTab.selectAll")}
      disabled={selectAllPressed}
      onClick={highlightAll}
      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent"
    >
      {t("connectionsTab.selectAll")}
    </button>
  );
  // The button sits on the first section that shows.
  const actionOnIncoming = shownIncoming.length > 0;

  const groupProps = {
    reorderable: !isSearching,
    dragState: isSearching ? null : dragState,
    dragOverId: isSearching ? null : dragOverId,
    focusedConnId,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
    onConnClick: handleConnClick,
    onFocusElement,
  };

  return (
    <div className="space-y-3 p-3">
      <label className="relative block">
        <span className="sr-only">{t("connectionsTab.filterPlaceholder")}</span>
        <Search
          aria-hidden
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("connectionsTab.filterPlaceholder")}
          className="w-full rounded-md border border-border bg-secondary py-1.5 pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>
      <ConnectionGroup
        label={t("connectionsTab.incoming")}
        rows={shownIncoming}
        side="incoming"
        action={actionOnIncoming ? highlightAllButton : undefined}
        {...groupProps}
      />
      <ConnectionGroup
        label={t("connectionsTab.outgoing")}
        rows={shownOutgoing}
        side="outgoing"
        action={actionOnIncoming ? undefined : highlightAllButton}
        {...groupProps}
      />
      {isSearching && shownIncoming.length === 0 && shownOutgoing.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("connectionsTab.noResultsFor", { query: search.trim() })}
        </p>
      )}
      {canReorder && (
        <p className="px-0.5 text-[11px] text-muted-foreground">
          {t("connectionsTab.dragReorderHint")}
        </p>
      )}
      {referencesSection}
    </div>
  );
};

export default ConnectionsTab;
