import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import {
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
} from "../plugin-registry";
import { getPanelRegistrySnapshot } from "../panel-registry";

/**
 * A bundled plugin that imports `@structura/ui`, as Rollup emits it with the documented
 * externals: an IIFE handed `__REACT__` and `__STRUCTURA_UI__` (see the example-ui plugin's
 * `vite.config.js`). Installed through the real registry, its panel renders host components.
 */
const BUNDLE = `
(function (React, ui) {
  function Panel(props) {
    return React.createElement(ui.Card, { title: "Plugin card" },
      React.createElement(ui.Button, { variant: "outline" }, "Plugin action"));
  }
  window.StructuraPlugin.define({
    manifest: {
      id: "ui-kit-bundle-test",
      name: "UI kit bundle",
      version: "1.0.0",
      author: "Tests",
      description: "Imports @structura/ui",
      apiVersion: "^1.18",
      capabilities: ["ui:panels"],
    },
    activate: function (api) {
      api.registerPanel({ id: "ui-kit-bundle-test/panel", slot: "element-inspector", title: "Kit", component: Panel });
    },
  });
})(__REACT__, __STRUCTURA_UI__);
`;

describe("@structura/ui in a bundled plugin", () => {
  beforeEach(async () => {
    await initializePluginRegistry(new InMemoryAdapter());
  });

  afterEach(async () => {
    await resetPluginRegistryForTests();
  });

  it("binds to the host kit global and renders host components", async () => {
    const install = await installPluginFromCode(BUNDLE);
    expect(install).toMatchObject({ ok: true });

    const panel = getPanelRegistrySnapshot().find((p) => p.id === "ui-kit-bundle-test/panel");
    expect(panel).toBeDefined();
    render(
      createElement(panel!.component, {
        context: {
          selection: [],
          service: null,
          updateComponent: () => {},
          updateService: () => {},
          locale: "en",
          isEditMode: true,
        },
      }),
    );
    expect(screen.getByText("Plugin card")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plugin action" }).className).toContain(
      "border-input",
    );
  });
});
