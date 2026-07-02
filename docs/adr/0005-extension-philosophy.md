# ADR-0005 — Registries + descriptors as the extension mechanism

**Status:** Accepted

## Context

Structura must support many contributed capabilities (node types, importers,
commands, panels, providers) without core edits. Candidate mechanisms:
inheritance hierarchies, event/hook buses, dependency-injection containers,
runtime-loaded plugins, or declarative registries of descriptor objects. The
node system (`NodeTypeDescriptor` + `NODE_TYPE_REGISTRY`) already proved one
of these in production.

## Decision

Every extension point follows the descriptor-registry pattern:

1. A **contribution** is a plain object: declarative fields + pure builder
   functions. No classes, no inheritance.
2. A **registry** validates at registration (unique ids, ordering
   invariants) and fails loudly.
3. Contributions read from an explicit **context object** (like
   `NodeBuildContext`) — never from feature internals.
4. **Built-ins register through the same mechanism** future plugins will use;
   if core can't express itself as contributions, the contract is wrong.
5. Extension points are introduced **by spec** and start as build-time
   (static import) registrations. No runtime plugin loader, sandboxing, or
   marketplace until a spec justifies them
   (see [plugin-system-preparation](../architecture/plugin-system-preparation.md)).

## Consequences

- (+) Uniformity: learning one extension point teaches all of them.
- (+) Descriptors are data — enumerable, validatable, testable in isolation,
  and forward-compatible with a future manifest-based plugin host.
- (−) Registries add indirection; simple features pay a structural tax.
  Mitigation: an extension point is only created when ≥2 real
  implementations exist or a spec commits to them ("rule of two").
- (−) Static registration means third parties must fork-or-PR to contribute
  until a loader exists. Deliberate: API stability before distribution.
- Review rules: behavior varying by type goes through a registry, not a
  `switch`; new extension points without a spec are rejected.
