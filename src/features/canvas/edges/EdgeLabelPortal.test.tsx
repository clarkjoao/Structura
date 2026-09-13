import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  EdgeLabelPortal,
  EdgeLabelPortalProvider,
  useEdgeLabelPortalContainer,
} from "./EdgeLabelPortal";

/**
 * Stands in for EdgeLabelPortalHost's attach path (ref callback into the shared
 * container). Avoids React Flow's store; mirrors the host's attach contract.
 */
function TestHost() {
  const container = useEdgeLabelPortalContainer();
  return (
    <div
      data-testid="host"
      ref={(mount) => {
        if (!container) return;
        if (mount) {
          if (container.parentElement !== mount) mount.appendChild(container);
          return;
        }
        if (container.parentElement) container.remove();
      }}
    />
  );
}

/**
 * Reproduces the real host failure mode: the mount node is missing on the first
 * paint (EdgeLabelRenderer returned null), then appears later without the host
 * component identity changing. A mount-only useEffect keyed on `container`
 * would miss that transition and leave portals detached.
 */
function LateMountHost({ showMount }: { showMount: boolean }) {
  const container = useEdgeLabelPortalContainer();
  if (!showMount) return null;
  return (
    <div
      data-testid="host"
      ref={(mount) => {
        if (!container) return;
        if (mount) {
          if (container.parentElement !== mount) mount.appendChild(container);
          return;
        }
        if (container.parentElement) container.remove();
      }}
    />
  );
}

function LateMountFixture({ children }: { children: ReactNode }) {
  const [showMount, setShowMount] = useState(false);
  return (
    <EdgeLabelPortalProvider>
      <button type="button" onClick={() => setShowMount(true)}>
        ready
      </button>
      <LateMountHost showMount={showMount} />
      {children}
    </EdgeLabelPortalProvider>
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

  it("attaches a portal that rendered before the mount node existed", () => {
    let sharedContainer: HTMLElement | null = null;
    function CaptureContainer() {
      sharedContainer = useEdgeLabelPortalContainer();
      return null;
    }

    render(
      <LateMountFixture>
        <CaptureContainer />
        <EdgeLabelPortal>
          <span data-testid="toolbar">toolbar</span>
        </EdgeLabelPortal>
      </LateMountFixture>,
    );

    // Content already rendered into the detached container, but not in the document —
    // the failure mode that hid EdgeToolbar after the single-renderer change.
    expect(sharedContainer).not.toBeNull();
    expect(sharedContainer!.querySelector("[data-testid='toolbar']")).not.toBeNull();
    expect(document.body.contains(sharedContainer)).toBe(false);
    expect(screen.queryByTestId("toolbar")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ready" }));

    const toolbar = screen.getByTestId("toolbar");
    expect(document.body.contains(sharedContainer)).toBe(true);
    expect(screen.getByTestId("host").contains(toolbar)).toBe(true);
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
