import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { createContributionTracker, createScopedPluginApi } from "../plugin-api";
import { installPluginRuntimeGlobals, PLUGIN_UI_GLOBAL } from "../runtime-globals";
import type { PluginManifest } from "../plugin.types";
import { PLUGIN_UI_KIT } from ".";

const { Button, Card, Checkbox, Field, Input, Select, Stack, Tabs, Tooltip } = PLUGIN_UI_KIT;

beforeAll(() => {
  // Radix Select measures and scrolls its list; jsdom has neither.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

describe("plugin UI kit", () => {
  it("renders the host button with its variant classes and the plugin's className", () => {
    render(
      <Button variant="outline" className="plugin-own">
        Run
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(button.className).toContain("border-input");
    expect(button.className).toContain("plugin-own");
  });

  it("wires a Field's label and hint to its control", () => {
    render(
      <Field label="Token" hint="From your account settings">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Token");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("From your account settings").id).toBe(
      input.getAttribute("aria-describedby"),
    );
  });

  it("reports a Select pick as the option's value", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        aria-label="Region"
        options={[
          { value: "eu", label: "Europe" },
          { value: "us", label: "United States" },
        ]}
        onValueChange={onValueChange}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Region" });
    expect(trigger.textContent).toBe("Select…");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "United States" }));
    expect(onValueChange).toHaveBeenCalledWith("us");
  });

  it("reports a Checkbox as a boolean", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Sync" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Sync" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("builds Tabs and Card from data", () => {
    render(
      <Card title="Settings" footer={<Button>Save</Button>}>
        <Tabs
          tabs={[
            { value: "a", label: "General", content: "General content" },
            { value: "b", label: "Advanced", content: "Advanced content" },
          ]}
        />
      </Card>,
    );
    expect(screen.getByText("Settings")).toBeTruthy();
    // A block description must not end up inside a <p> (invalid nesting).
    render(<Card title="T" description={<div>Block description</div>} />);
    expect(screen.getByText("Block description").closest("p")).toBeNull();
    expect(screen.getByText("General content")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("lays out a Stack with inline styles, not host utility classes", () => {
    render(
      <Stack direction="row" gap={6} justify="between">
        <span>a</span>
      </Stack>,
    );
    const stack = screen.getByText("a").parentElement!;
    expect(stack.style.flexDirection).toBe("row");
    expect(stack.style.gap).toBe("24px");
    expect(stack.style.justifyContent).toBe("space-between");
  });

  it("renders a Tooltip trigger as the plugin's own element", async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Runs the import">
          <Button>Import</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    await act(async () => {
      fireEvent.focus(screen.getByRole("button", { name: "Import" }));
    });
    expect((await screen.findAllByText("Runs the import")).length).toBeGreaterThan(0);
  });
});

describe("plugin UI kit doors", () => {
  const manifest: PluginManifest = {
    id: "ui-kit-test",
    name: "UI kit test",
    version: "1.0.0",
    author: "Tests",
    description: "Tests the v1.18 UI kit",
    apiVersion: "^1.18",
    capabilities: [],
  };

  it("hands plugins the same components on api.ui and the @structura/ui global", () => {
    installPluginRuntimeGlobals();
    const api = createScopedPluginApi(manifest, createContributionTracker(), new InMemoryAdapter());
    const global = window[PLUGIN_UI_GLOBAL]!;
    for (const name of Object.keys(PLUGIN_UI_KIT) as (keyof typeof PLUGIN_UI_KIT)[]) {
      expect(api.ui[name], name).toBe(PLUGIN_UI_KIT[name]);
      expect(global[name], name).toBe(PLUGIN_UI_KIT[name]);
    }
    expect(api.ui.CodeEditor).toBeDefined();
  });
});
