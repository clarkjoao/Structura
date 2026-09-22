import { vi } from "vitest";
import "./jsdom-globals";
import "@testing-library/jest-dom/vitest";
import "@/infrastructure/i18n";
import "@/features/elements/bootstrap";

/**
 * Everything these imports pull in — the element registry, and with it the
 * `@/features/diagram` barrel and much of `@/features/canvas` — is instantiated
 * before any test file runs. A `vi.mock` factory for one of those modules is
 * then too late: the test file gets the mock, while the code under test keeps
 * its binding to the real export, and the mock silently does nothing.
 *
 * Use `vi.spyOn(module, "export")` on the live module for anything in this
 * graph. `vi.mock` still works for modules outside it (sonner, adapters, …).
 */

/**
 * Monaco cannot run in jsdom — it measures glyphs against a real layout engine.
 * The stand-in keeps the contract the app depends on, which is the whole of it:
 * a value in, a string out on every change. Anything that needs the real editor
 * has to be checked in a browser, and is.
 */
vi.mock("@/lib/monaco/LazyMonacoEditor", () => ({
  LazyMonacoEditor: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <textarea
      data-testid="monaco-stand-in"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));
