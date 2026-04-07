import { afterEach, describe, expect, it } from "vitest";
import type { CustomComponentTemplate } from "../types";
import { useCustomComponentStore } from "../store/custom-components.store";

function baseTemplate(overrides: Partial<CustomComponentTemplate> = {}): CustomComponentTemplate {
  return {
    id: "t1",
    name: "T",
    baseType: "system",
    data: {},
    templateVersion: 1,
    category: "general",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("custom-components store", () => {
  afterEach(() => {
    useCustomComponentStore.setState({ templates: {} });
  });

  it("addTemplate stores template with templateVersion 1 when provided", () => {
    useCustomComponentStore.getState().addTemplate(baseTemplate({ templateVersion: 1 }));
    expect(useCustomComponentStore.getState().templates.t1?.templateVersion).toBe(1);
  });

  it("updateTemplate increments templateVersion", () => {
    useCustomComponentStore.getState().addTemplate(baseTemplate());
    useCustomComponentStore.getState().updateTemplate("t1", { name: "Renamed" });
    expect(useCustomComponentStore.getState().templates.t1?.templateVersion).toBe(2);
    expect(useCustomComponentStore.getState().templates.t1?.name).toBe("Renamed");
  });

  it("deleteTemplate removes the template", () => {
    useCustomComponentStore.getState().addTemplate(baseTemplate());
    useCustomComponentStore.getState().deleteTemplate("t1");
    expect(useCustomComponentStore.getState().templates.t1).toBeUndefined();
  });

  it("getTemplateById returns null for missing id", () => {
    expect(useCustomComponentStore.getState().getTemplateById("missing")).toBeNull();
  });

  it("normalizes empty category to general on add", () => {
    useCustomComponentStore.getState().addTemplate(
      baseTemplate({ id: "c", category: "   " }),
    );
    expect(useCustomComponentStore.getState().templates.c?.category).toBe("general");
  });

  it("normalizes invalid templateVersion to 1 on add", () => {
    useCustomComponentStore.getState().addTemplate(
      baseTemplate({ id: "v", templateVersion: 0 }),
    );
    expect(useCustomComponentStore.getState().templates.v?.templateVersion).toBe(1);
  });
});
