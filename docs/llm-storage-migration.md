# LLM Storage Migration to IStoragePort

## Status: Foundation Complete, Full Migration TBD

The IStoragePort interface has been extended with `keys()` and `length()` methods,
and adapters (LocalStorageAdapter, InMemoryAdapter) have been updated.

A `SyncStorageAdapter` bridge class has been created to enable future migration
of sync consumers to async IStoragePort patterns.

## Why Full Migration is Deferred

The `llm-storage.ts` module currently uses synchronous localStorage access:
- `loadConnections()` - sync read at boot
- `saveConnections()` - sync write on state change
- `loadThreadsForDiagram()` - sync read (cache-backed)
- `saveThreadsForDiagram()` - sync write (cache-backed)

Converting to async would require:
1. Making all LLM store initializers async
2. Updating Zustand store actions to handle async persistence
3. Updating all test fixtures
4. Changing the boot sequence

This is a significant refactor (estimated 1-2 sprints) and was deprioritized
in favor of completing the audit fixes.

## Migration Path

When ready to migrate, use the `SyncStorageAdapter` as a reference:

```typescript
import { defaultStorage, SyncStorageAdapter } from "@/infrastructure/persistence";

// Create async storage instance
const storage = new SyncStorageAdapter(defaultStorage);

// Then migrate functions:
export async function loadConnections(): Promise<ConnectionsPayload> {
  const value = await storage.load<string>(LLM_CONNECTIONS_KEY);
  // ...
}
```

## Current State

- [x] IStoragePort extended with keys() and length()
- [x] LocalStorageAdapter implements new methods
- [x] InMemoryAdapter implements new methods
- [x] persist.config.ts updated
- [x] SyncStorageAdapter bridge created
- [ ] llm-storage.ts migrated to async
- [ ] All callers updated to async patterns

## Files Affected

- `src/features/llm/llm-storage.ts` - needs migration
- `src/features/llm/store.ts` - needs async updates
- `src/features/llm/llm-storage.test.ts` - needs async test updates
- `src/features/llm/store.new-connection.test.ts` - needs async updates
