import { vi } from "vitest";
import "./jsdom-globals";
import "@testing-library/jest-dom/vitest";
import "@/infrastructure/i18n";
import "@/features/elements/bootstrap";

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
