import en from "@/infrastructure/i18n/locales/en.json";
import ptBR from "@/infrastructure/i18n/locales/pt-BR.json";
import type { Component } from "@/features/diagram";
import type { ElementDescriptor, ElementTypeId, RegisteredElementTypeId } from "./element.types";

/**
 * The element registry.
 *
 * One record per element kind, holding everything the seven consumers need:
 * creation, render, palette, inspector, export, LLM catalog and type
 * validation. It is deliberately a leaf module — it imports no canvas
 * component and no store — so `features/diagram` can read it without closing
 * an import cycle. Descriptors live in `./structural/*` and register
 * themselves through `./bootstrap`.
 *
 * While the migration runs, a type is owned by exactly one path: registered
 * here, or handled by the legacy chain, never both. `single-owner.invariant.test.ts`
 * holds that.
 */

const LOCALES: Record<string, unknown> = { en, "pt-BR": ptBR };

/** Reads a dotted i18n key out of a locale bundle, or `undefined`. */
function lookupLocaleKey(bundle: unknown, key: string): unknown {
  let current: unknown = bundle;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Locale ids missing a usable string for `key`. */
function localesMissing(key: string): string[] {
  return Object.entries(LOCALES)
    .filter(([, bundle]) => {
      const value = lookupLocaleKey(bundle, key);
      return typeof value !== "string" || value.length === 0;
    })
    .map(([locale]) => locale);
}

const registry = new Map<ElementTypeId, ElementDescriptor>();
const listeners = new Set<() => void>();

/**
 * Subscribe to registrations; returns unsubscribe.
 *
 * The canvas needs to rebuild its React Flow `nodeTypes` map when an element
 * appears, and this module must not import the canvas to tell it so. Inverting
 * the dependency is what keeps the registry a leaf.
 */
export function subscribeElements(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyElementsChanged(): void {
  for (const listener of listeners) listener();
}

function fail(id: string, reason: string): never {
  throw new Error(`[elements] Cannot register "${id}": ${reason}`);
}

/**
 * Validates and registers a descriptor. Throws synchronously — a malformed
 * element is a programming error at module-evaluation time, not a runtime
 * degradation, and the app should refuse to boot rather than render half of it.
 */
export function registerElement(descriptor: ElementDescriptor): void {
  const { id } = descriptor;

  if (!id) fail(String(id), "the descriptor has no id.");
  if (registry.has(id)) fail(id, "an element with this id is already registered.");

  if (!descriptor.export?.drawio?.toExportNode) {
    fail(
      id,
      "export.drawio is required — every element must declare how it maps to a draw.io shape.",
    );
  }

  if (!descriptor.canvas?.handles) {
    fail(id, "canvas.handles is required — the handle set is declared, never inferred.");
  }

  for (const [field, key] of [
    ["labelKey", descriptor.labelKey],
    ["descriptionKey", descriptor.descriptionKey],
  ] as const) {
    if (!key) fail(id, `${field} is required.`);
    const missing = localesMissing(key);
    if (missing.length > 0) {
      fail(id, `${field} "${key}" has no entry in locale(s): ${missing.join(", ")}.`);
    }
  }

  registry.set(id, descriptor);
  notifyElementsChanged();
}

export function getElement(type: string): ElementDescriptor | undefined {
  return registry.get(type as ElementTypeId);
}

export function hasElement(type: string): boolean {
  return registry.has(type as ElementTypeId);
}

/**
 * `hasElement` with the narrowing the legacy chains need.
 *
 * The predicate is a promise that what `bootstrap.ts` registers matches
 * `RegisteredElementTypeId`; the single-owner invariant test is what keeps the
 * promise honest, in both directions.
 */
export function isRegisteredElementType(type: string): type is RegisteredElementTypeId {
  return registry.has(type as ElementTypeId);
}

/**
 * `isRegisteredElementType` for a whole component.
 *
 * Narrowing the component (not just its `type`) is what lets a guard chain over
 * the `Component` union drop a migrated variant and keep its
 * `const _exhaustive: never`.
 */
export function isRegisteredElementComponent(
  comp: Component,
): comp is Extract<Component, { type: RegisteredElementTypeId }> {
  return registry.has(comp.type as ElementTypeId);
}

export function allElements(): ElementDescriptor[] {
  return [...registry.values()];
}

export function registeredElementIds(): ElementTypeId[] {
  return [...registry.keys()];
}

/** Test-only: drop a registration so a suite can re-register its own fixture. */
export function unregisterElement(type: string): void {
  if (registry.delete(type as ElementTypeId)) notifyElementsChanged();
}
