import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EdgeLabelPortal,
  EdgeLabelPortalProvider,
  useEdgeLabelPortalContainer,
} from "./EdgeLabelPortal";

/** Stands in for EdgeLabelPortalHost, which needs a React Flow store to render. */
function TestHost() {
  const container = useEdgeLabelPortalContainer();
  return (
    <div
      data-testid="host"
      ref={(mount) => {
        if (mount && container) mount.appendChild(container);
      }}
    />
  );
}

describe("EdgeLabelPortal", () => {
  it("renders many edges' labels into one shared container", () => {
    const { container } = render(
      <EdgeLabelPortalProvider>
        <TestHost />
        <div data-testid="tree">
          {Array.from({ length: 5 }, (_, i) => (
            <EdgeLabelPortal key={i}>
              <span data-label={i}>label {i}</span>
            </EdgeLabelPortal>
          ))}
        </div>
      </EdgeLabelPortalProvider>,
    );

    const labels = document.querySelectorAll("[data-label]");
    expect(labels).toHaveLength(5);
    // all five landed in the same parent element
    const parents = new Set([...labels].map((el) => el.parentElement));
    expect(parents.size).toBe(1);
    // and none of them is inline in the caller's tree
    expect(container.querySelector("[data-testid='tree'] [data-label]")).toBeNull();
  });

  it("renders nothing outside a provider instead of throwing", () => {
    expect(() =>
      render(
        <EdgeLabelPortal>
          <span data-testid="orphan">x</span>
        </EdgeLabelPortal>,
      ),
    ).not.toThrow();
    expect(screen.queryByTestId("orphan")).toBeNull();
  });
});

/**
 * The cost this change removes is proportional to how many
 * `<EdgeLabelRenderer>` instances are mounted, so the count is the contract:
 * exactly one, in the host. An edge component reaching for it directly puts the
 * per-edge `querySelector` back.
 */
describe("edge-label renderer instances", () => {
  it("is imported by the portal host and nowhere else under features/canvas", () => {
    // an import, not a mention: prose may name it, code may not reach for it
    const root = join(process.cwd(), "src/features/canvas");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (entry.startsWith("EdgeLabelPortal.")) continue;
        const source = readFileSync(full, "utf8");
        const importsIt =
          /import\s*\{[^}]*\bEdgeLabelRenderer\b[^}]*\}\s*from\s*["']@xyflow\/react["']/s.test(
            source,
          );
        if (importsIt) offenders.push(full.slice(root.length + 1));
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});
