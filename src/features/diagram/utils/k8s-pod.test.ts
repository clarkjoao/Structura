import { describe, expect, it } from "vitest";
import type { Component } from "../model/component.types";
import type { Connection } from "../model/connection.types";
import { isInPodLink, isMeshed, podContainers, sidecarCaption, withPodLinkStyle } from "./k8s-pod";
import type { K8sContainerComponent, K8sWorkloadComponent } from "../model/component.types";

const c = (id: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: "wl",
    type: "k8s-container",
    ...extra,
  }) as unknown as Component;

function world(meshInjection?: boolean): Record<string, Component> {
  return {
    ns: {
      id: "ns",
      name: "shop",
      description: "",
      parentId: null,
      type: "k8s-namespace",
      ...(meshInjection !== undefined ? { meshInjection } : {}),
    } as Component,
    wl: {
      id: "wl",
      name: "api",
      description: "",
      parentId: "ns",
      type: "k8s-workload",
    } as Component,
    app: c("app"),
    envoy: c("envoy", { podRole: "sidecar", purpose: "proxy" }),
    fluent: c("fluent", { podRole: "sidecar" }),
    migrate: c("migrate", { podRole: "init", order: 2 }),
    wait: c("wait", { podRole: "init", order: 1 }),
    other: c("other", { parentId: "elsewhere" }),
  };
}

describe("podContainers", () => {
  it("sorts the workload's containers by role; a missing role is main", () => {
    const layouts = {
      envoy: { elementId: "envoy", x: 0, y: 200, width: 1, height: 1 },
      fluent: { elementId: "fluent", x: 0, y: 100, width: 1, height: 1 },
    };
    const pod = podContainers("wl", world(), layouts);
    expect(pod.main.map((x) => x.id)).toEqual(["app"]);
    expect(pod.sidecars.map((x) => x.id)).toEqual(["fluent", "envoy"]);
    expect(pod.inits.map((x) => x.id)).toEqual(["wait", "migrate"]);
  });

  it("puts an init without an order after the numbered ones", () => {
    const components = { ...world(), later: c("later", { podRole: "init" }) };
    expect(podContainers("wl", components).inits.map((x) => x.id)).toEqual([
      "wait",
      "migrate",
      "later",
    ]);
  });
});

describe("sidecarCaption", () => {
  it("names the function when there is one", () => {
    const pod = world();
    expect(sidecarCaption(pod.envoy as K8sContainerComponent, "sidecar")).toBe("sidecar · proxy");
    expect(sidecarCaption(pod.fluent as K8sContainerComponent, "sidecar")).toBe("sidecar");
    expect(
      sidecarCaption({ ...(pod.fluent as K8sContainerComponent), purpose: "  " }, "sidecar"),
    ).toBe("sidecar");
  });
});

describe("isMeshed", () => {
  it("follows the nearest namespace's injection flag", () => {
    expect(isMeshed(world(true).wl as K8sWorkloadComponent, world(true))).toBe(true);
    expect(isMeshed(world(false).wl as K8sWorkloadComponent, world(false))).toBe(false);
    expect(isMeshed(world().wl as K8sWorkloadComponent, world())).toBe(false);
  });

  it("is false outside any namespace, and survives a parent cycle", () => {
    const loose = { id: "w", name: "w", description: "", parentId: null, type: "k8s-workload" };
    expect(isMeshed(loose as K8sWorkloadComponent, {})).toBe(false);
    const cyclic: Record<string, Component> = {
      w: { ...loose, parentId: "a" } as Component,
      a: { id: "a", name: "a", description: "", parentId: "b", type: "k8s-cluster" } as Component,
      b: { id: "b", name: "b", description: "", parentId: "a", type: "k8s-cluster" } as Component,
    };
    expect(isMeshed(cyclic.w as K8sWorkloadComponent, cyclic)).toBe(false);
  });
});

describe("isInPodLink", () => {
  const link = (sourceId: string, targetId: string) =>
    ({ id: "l", sourceId, targetId, label: "" }) as Connection;
  it("is a link between two containers of one pod, and nothing else", () => {
    expect(isInPodLink(link("envoy", "app"), world())).toBe(true);
    expect(isInPodLink(link("envoy", "other"), world())).toBe(false);
    expect(isInPodLink(link("wl", "app"), world())).toBe(false);
    expect(isInPodLink(link("app", "ghost"), world())).toBe(false);
  });
});

describe("withPodLinkStyle", () => {
  const link = (extra: Partial<Connection> = {}) =>
    ({ id: "l", sourceId: "envoy", targetId: "app", label: "", ...extra }) as Connection;

  it("draws an unstyled in-pod link dashed teal, without touching the stored one", () => {
    const stored = link();
    const drawn = withPodLinkStyle(stored, world());
    expect(drawn.style).toEqual({ strokeStyle: "dashed", color: "hsl(var(--node-system))" });
    expect(stored.style).toBeUndefined();
  });

  it("keeps what the author chose, and leaves other links alone", () => {
    expect(withPodLinkStyle(link({ style: { color: "red" } }), world()).style).toEqual({
      color: "red",
      strokeStyle: "dashed",
    });
    const both = link({ style: { color: "red", strokeStyle: "solid" as never } });
    expect(withPodLinkStyle(both, world())).toBe(both);
    const outside = link({ sourceId: "wl" });
    expect(withPodLinkStyle(outside, world())).toBe(outside);
  });

  it("reads the stored ends when the drawn ones were redrawn onto a compact workload", () => {
    const drawn = link({ targetId: "wl" });
    expect(withPodLinkStyle(drawn, world(), link()).style?.strokeStyle).toBe("dashed");
  });
});
