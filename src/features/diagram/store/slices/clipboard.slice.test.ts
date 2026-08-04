import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";

describe("clipboard paste of api-group with endpoints", () => {
  it("preserves parent-child relationship between api-group and its endpoints", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Test", "context");
    store.getState().openDiagram(diagram.id);

    // Create an api-group
    const apiGroup = store.getState().addComponent("api-group", "API", null, {
      x: 100,
      y: 100,
    });

    // Add an endpoint as a child of the api-group
    const endpoint = store.getState().addComponent(
      "endpoint",
      "GET /test",
      apiGroup.id,
    );

    // Sanity: endpoint.parentId is the api-group
    expect(apiGroup.parentId).toBeNull();
    expect(endpoint.parentId).toBe(apiGroup.id);

    // Copy the api-group (children are auto-included by getCopyableIds,
    // but copyToClipboard should at least take the api-group id).
    store.getState().copyToClipboard([apiGroup.id, endpoint.id]);

    // Paste
    const pastedIds = store.getState().pasteFromClipboard({ x: 500, y: 500 });
    expect(pastedIds).toHaveLength(2);

    // Read the pasted components back
    const after = store.getState();
    const activeDiagramId = after.activeDiagramId!;
    const d = after.diagrams[activeDiagramId];
    const pastedComponents = pastedIds.map((id) => d.snapshot.components[id]);
    const [pastedGroup, pastedEndpoint] = pastedComponents;

    // The new api-group must NOT inherit the original parentId (it had none,
    // so this is just a sanity check).
    expect(pastedGroup.id).not.toBe(apiGroup.id);
    expect(pastedGroup.parentId).toBeNull();

    // The new endpoint must point to the *new* api-group, not the original.
    expect(pastedEndpoint.id).not.toBe(endpoint.id);
    expect(pastedEndpoint.parentId).toBe(pastedGroup.id);
  });

  it("detaches the pasted api-group from its source panel", () => {
    // Reproduces the user-reported bug: copying an api-group that lives
    // inside a panel and pasting it elsewhere should leave the copy at the
    // canvas root (or under the new paste-target panel), not leave the
    // endpoint pointing at the OLD api-group id.
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Test", "context");
    store.getState().openDiagram(diagram.id);

    const panel = store.getState().addComponent("panel", "Container", null, {
      x: 0,
      y: 0,
    });
    const apiGroup = store.getState().addComponent(
      "api-group",
      "API",
      panel.id,
      { x: 50, y: 50 },
    );
    const endpoint = store.getState().addComponent(
      "endpoint",
      "GET /a",
      apiGroup.id,
    );

    expect(apiGroup.parentId).toBe(panel.id);
    expect(endpoint.parentId).toBe(apiGroup.id);

    store.getState().copyToClipboard([apiGroup.id, endpoint.id]);
    const pastedIds = store.getState().pasteFromClipboard({ x: 600, y: 600 });
    expect(pastedIds).toHaveLength(2);

    const d = store.getState().diagrams[store.getState().activeDiagramId!];
    const [pastedGroupId, pastedEndpointId] = pastedIds;
    const pastedGroup = d.snapshot.components[pastedGroupId];
    const pastedEndpoint = d.snapshot.components[pastedEndpointId];

    // The pasted api-group must NOT keep the source panel as parent.
    expect(pastedGroup.parentId).toBeNull();
    // The pasted endpoint must point to the NEW api-group, not the original.
    expect(pastedEndpoint.parentId).toBe(pastedGroup.id);
  });
});
