import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore, ServiceSource } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceLinkField } from "./ServiceLinkField";
import { buildServiceLinkSource, suggestService } from "./serviceLinkItems";

vi.mock("@/features/collaboration", () => ({ useCollab: () => ({ isGuest: false }) }));

const svc = (
  id: string,
  name: string,
  extra: Partial<ServiceDefinition> = {},
): ServiceDefinition => ({
  id,
  name,
  description: "",
  repositoryUrl: "",
  technology: [],
  ...extra,
});

function seed(services: ServiceDefinition[]) {
  useDiagramStore.setState({ services: Object.fromEntries(services.map((s) => [s.id, s])) });
}

function renderField(props: Partial<Parameters<typeof ServiceLinkField>[0]> = {}) {
  const onServiceChange = vi.fn();
  const onSync = vi.fn();
  render(
    <ServiceLinkField
      componentId="el"
      elementName="cob-api"
      serviceId={undefined}
      linkedService={null}
      onSync={onSync}
      onServiceChange={onServiceChange}
      {...props}
    />,
  );
  return { onServiceChange, onSync };
}

describe("buildServiceLinkSource / suggestService", () => {
  const options = { sourceLabel: (id: string) => `src:${id}` };

  it("lists services by name, with technology and owner, grouped by where they came from", () => {
    const { items, groups } = buildServiceLinkSource(
      [
        svc("b", "ledger", {
          technology: ["Java", "Kafka"],
          owner: "squad-core",
          source: ServiceSource.Github,
        }),
        svc("a", "cob-api", { technology: ["Go"] }),
      ],
      options,
    );
    expect(items.map((i) => i.label)).toEqual(["cob-api", "ledger"]);
    expect(items[1]).toMatchObject({
      description: "Java, Kafka · squad-core",
      groupIds: ["github"],
    });
    expect(groups.map((g) => g.id).sort()).toEqual(["__manual__", "github"]);
  });

  it("suggests the same-named service, and nothing for an empty name", () => {
    const { items } = buildServiceLinkSource([svc("a", "Cob-API")], options);
    expect(suggestService(items, " cob-api ", "r")[0]?.item.id).toBe("a");
    expect(suggestService(items, "", "r")).toEqual([]);
    expect(suggestService(items, "cob", "r")).toEqual([]);
  });
});

describe("ServiceLinkField", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    seed([svc("a", "cob-api", { technology: ["Go", "gRPC"] }), svc("b", "ledger-engine")]);
  });

  it("is the same trigger as the linked diagram: a '+ Link a service' button, nothing to unlink", () => {
    renderField();
    expect(screen.getByRole("button", { name: /Link a service/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull();
  });

  it("opens the link palette with the context line and the same-name suggestion", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: /Link a service/ }));
    expect(screen.getByText("Link service to cob-api")).toBeTruthy();
    expect(screen.getByText("Same name as this element")).toBeTruthy();
    expect(screen.getByText("Go, gRPC")).toBeTruthy();
  });

  it("↵ links the suggested service", () => {
    const { onServiceChange } = renderField();
    fireEvent.click(screen.getByRole("button", { name: /Link a service/ }));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onServiceChange).toHaveBeenCalledWith("a");
  });

  it("create-and-link registers a manual service named like the element", () => {
    const { onServiceChange } = renderField({ elementName: "brand-new" });
    fireEvent.click(screen.getByRole("button", { name: /Link a service/ }));
    fireEvent.click(screen.getByText("Create “brand-new” and link"));
    const created = Object.values(useDiagramStore.getState().services).find(
      (s) => s.name === "brand-new",
    );
    expect(created).toBeDefined();
    expect(onServiceChange).toHaveBeenCalledWith(created?.id);
  });

  it("shows the linked service, unlinks it, and keeps Sync on the label's row", () => {
    const linked = svc("a", "cob-api");
    const { onServiceChange, onSync } = renderField({ serviceId: "a", linkedService: linked });
    expect(screen.getByRole("button", { name: /cob-api/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onServiceChange).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
    expect(onSync).toHaveBeenCalled();
  });

  it("a link to a service that is gone still shows, so it can be removed", () => {
    renderField({ serviceId: "gone", linkedService: null });
    expect(screen.getByRole("button", { name: /gone.*missing/ })).toBeTruthy();
  });
});
