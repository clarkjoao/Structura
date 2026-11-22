## Context

The guided text capture (`guided.outline.ts`) runs `parseOutline` → `buildOutline` → `KindTextBuild`. The builder owns everything a paste must get right:

- the anchor (after the selection, or before the end of the main path);
- lane matching and creation;
- provisional positions;
- one edit;
- refusals.

Mermaid is a graph, while the outline AST is a tree of sequences with decisions, jumps and convergence. The canvas paste, the panel and the assistant all go through `capture.build`.

## Decisions

### 1. Mermaid becomes the outline AST, so the builder stays the single path

`parseMermaid(text) → ParsedOutline` turns the graph into the same `OutlineItem[]` tree. Everything downstream stays shared: anchor, lanes, layout, undo, the summary, and the assistant's checks.

The graph is turned into a tree by a depth-first walk from the entry nodes, in declaration order. This is the serializer's algorithm in reverse:

- A node's first visit emits it.
- A node with several outgoing edges becomes the parent of `exits`, one per edge, with the edge's label. A non-decision with several exits keeps its shape. The builder already accepts any node with exits, and the checks flag it.
- A node reached again emits a **jump by reference**.

Two small AST extensions follow:

- `OutlineNode.ref?: string` (the Mermaid id) and `OutlineJump.ref?: string`. The builder resolves `ref` through a `writtenByRef` map before falling back to the name, so duplicate labels never make a jump ambiguous.
- `OutlineNode.shape?: FlowNodeShape`, for data and subprocess nodes. Without it, the builder keeps today's mapping from step, decision and end.

The alternative was a second builder from graph to `KindEdit`. It was rejected because it would duplicate the anchor, lane and position logic, and the two would drift apart.

### 2. Entry and start handling

The entry nodes are the nodes with no incoming edge, in declaration order. Each becomes a walk that hangs from the anchor.

- **One entry:** its walk is the top-level sequence. The builder connects it from the anchor's open ends, as for an outline.
- **Several entries:** the parser wraps them in a **fan-out**, `{ kind: "fanout", branches: OutlineItem[][] }`. The builder connects each branch from the anchor's open ends, like an unlabelled set of exits, and collects the open ends of every branch. This is the one new AST node; the outline syntax cannot produce it.
- **No entry** (every node sits on a cycle): the first declared node is the entry.

A start-shaped entry (a circle or stadium with no incoming edge) is not emitted. Its outgoing edges become the entries, keeping their labels, so a pasted `start((Start)) --> a` never makes a second start. An end-shaped sink is emitted as `end`.

### 3. Journey blocks

The journey is read as a plain sequence:

- each task becomes a step;
- lane = first actor;
- every task is chained to the next.

Section, score and other-actor counts go into `ParsedOutline.setAside: { sections, scores }`, which the summary shows. Parts 2 and 3 will store them instead.

### 4. The parser is a small line reader, not a Mermaid grammar

Mermaid's full flowchart grammar is large. We read the subset in the spec with a line tokenizer:

- the header;
- `subgraph`/`end`, as a stack;
- node declarations: `id`, then a shape opener and a label, with quoted labels;
- edge chains: split on the arrow tokens, and on `&` for groups;
- ignore-lists for styling and metadata.

Every line is either consumed or reported. Unknown syntax is an error, never silently dropped, so a user knows what did not come in.

The alternative was the `mermaid` package's parser. It was rejected because it is a heavy dependency for a paste, it is browser-only (DOMPurify, d3), and `swimlane-beta` is still changing.

### 5. Export: two serializers next to the outline one

- **`serializeMermaidSwimlane(diagram, ctx)`:**
  - ids `s1…sN` in reading order (depth-first from the start, then unreachable steps);
  - lanes in `readGuided` order;
  - a quoted label when it holds `[](){}|"<>`;
  - an `%%` header comment naming the source.
- **`serializeMermaidJourney(diagram, ctx)`:** walks the main path, as `anchorAtEnd` does. Each step is written as `Name: 3: <lane>`; the start and end steps are skipped, because they are not tasks. A comment counts what was left out.

`KindTextCapture.formats?: { id; label: KindText; serialize }[]`. The panel's copy button becomes a dropdown when `formats` exists. The first entry is today's outline.

### 6. Detection

`isMermaid(text)` strips a code fence and front matter, skips blank lines and `%%` lines, then tests the header regex. `guidedTextCapture.build` dispatches on it.

The canvas paste gate (`/^\s*[<{[]/`) is unchanged: a fence starts with a backtick, and Mermaid headers start with a letter.

## Risks

- **`swimlane-beta` syntax may still change.** Mitigation: the reader is ours and small, and the tests pin the documented examples.
- **Fan-out from the anchor adds one AST node kind.** It is kept internal to the parser and builder, and the outline syntax cannot produce it.
- **Big pasted graphs** (hundreds of nodes) go through the same single edit. That is acceptable, because the arrangement already handles the large-diagram path.
