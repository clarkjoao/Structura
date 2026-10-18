import type {
  DiagramSnapshot,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "../types/plugin.types";

/** A canvas that applies plugin changes the way the host does, close enough for diffs. */
export class FakeCanvas {
  components: PluginComponentSnapshot[] = [];
  connections: PluginConnectionSnapshot[] = [];
  private next = 0;
  private history: Array<[PluginComponentSnapshot[], PluginConnectionSnapshot[]]> = [];
  private future: Array<[PluginComponentSnapshot[], PluginConnectionSnapshot[]]> = [];

  snapshot(): DiagramSnapshot {
    return {
      id: "d",
      name: "d",
      description: null,
      components: structuredClone(this.components),
      connections: structuredClone(this.connections),
    };
  }

  /** One history step, like every store action. */
  step(change: () => void) {
    this.history.push(structuredClone([this.components, this.connections]));
    this.future = [];
    change();
  }

  undo() {
    this.future.push(structuredClone([this.components, this.connections]));
    [this.components, this.connections] = this.history.pop()!;
  }

  redo() {
    this.history.push(structuredClone([this.components, this.connections]));
    [this.components, this.connections] = this.future.pop()!;
  }

  remove(ids: string[]) {
    const gone = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of this.components) {
        if (c.parentId && gone.has(c.parentId) && !gone.has(c.id)) {
          gone.add(c.id);
          grew = true;
        }
      }
    }
    this.components = this.components.filter((c) => !gone.has(c.id));
    this.connections = this.connections.filter(
      (c) => !gone.has(c.sourceId) && !gone.has(c.targetId),
    );
  }

  connect(sourceId: string, targetId: string, label: string): string {
    const id = `e${this.next++}`;
    this.connections.push({ id, sourceId, targetId, label, description: null, technology: null });
    return id;
  }

  apply(changes: PluginDiagramChanges): PluginDiagramChangesResult {
    const result: PluginDiagramChangesResult = { idsByKey: {}, connectionIds: [] };
    if (Object.values(changes).every((l) => !l?.length)) return result;
    this.step(() => {
      this.remove(changes.remove ?? []);
      const cut = new Set(changes.disconnect ?? []);
      this.connections = this.connections.filter((c) => !cut.has(c.id));
      for (const u of changes.update ?? []) {
        const c = this.components.find((x) => x.id === u.id);
        if (!c) continue;
        if (u.name !== undefined) c.label = u.name;
        if (u.description !== undefined) c.description = u.description;
        if (u.technology !== undefined) c.technology = u.technology || null;
        if (u.cloudServiceId !== undefined) c.cloudServiceId = u.cloudServiceId || null;
      }
      for (const m of changes.move ?? []) {
        const c = this.components.find((x) => x.id === m.id);
        if (!c) continue;
        c.position = { x: m.x, y: m.y };
        if (m.width !== undefined && m.height !== undefined)
          c.size = { width: m.width, height: m.height };
      }
      for (const a of changes.add ?? []) {
        const id = `c${this.next++}`;
        result.idsByKey[a.key] = id;
        const parent =
          a.parentKey === undefined ? null : (result.idsByKey[a.parentKey] ?? a.parentKey);
        this.components.push({
          id,
          type: a.type ?? "unknown",
          label: a.name,
          description: a.description ?? "",
          parentId: parent,
          position: { x: a.x ?? 0, y: a.y ?? 0 },
          size:
            a.width !== undefined && a.height !== undefined
              ? { width: a.width, height: a.height }
              : null,
          tags: [],
          serviceId: null,
          cloudServiceId: a.cloudServiceId ?? null,
          technology: a.technology ?? null,
        });
      }
      for (const c of changes.connect ?? []) {
        const source = result.idsByKey[c.source] ?? c.source;
        const target = result.idsByKey[c.target] ?? c.target;
        const id = `e${this.next++}`;
        this.connections.push({
          id,
          sourceId: source,
          targetId: target,
          label: c.label ?? "",
          description: null,
          technology: null,
        });
        result.connectionIds.push(id);
      }
    });
    return result;
  }
}
