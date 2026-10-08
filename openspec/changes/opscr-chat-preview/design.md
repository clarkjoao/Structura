# Design

**Handlers outside state.** `keep` / `discard` are functions; the store keeps them in a module map
keyed by suggestion id (threads persist only messages, and Zustand state stays serializable). The
suggestion itself is a regular `PendingSuggestion` with an empty patch and the plugin's title, so
the suggestion card and the canvas toolbars work unchanged.

**Discard is the plugin's job.** For plugin suggestions the host never removes elements itself:
the plugin restores its source text and its sync removes them. A refusal (string) keeps the change.

**Discard only when nothing changed since.** The opscr plugin snapshots the manifests before and
after applying the reply; discard restores "before" only while the manifests still equal "after".
Files the reply created are emptied.

**Focus.** Previews carry `focus: true`; the canvas fits the view to the pending nodes of a newly
arrived focused preview once they are rendered.

**One pending reply at a time.** Before a new plugin turn the host keeps (accepts) the plugin's
pending suggestions for that diagram: a discard after further replies would revert them too.
