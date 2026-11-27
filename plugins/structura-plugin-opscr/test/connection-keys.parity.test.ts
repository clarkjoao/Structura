import { describe, expect, it } from "vitest";
import { connectionKeys as protocolKeys } from "@/features/plugins/connection-keys";
import { connectionKeys } from "../src/opscr-mapping";

/**
 * The embed preview names a connection by its ends, label and occurrence (its protocol,
 * `src/features/plugins/connection-keys.ts`), and the plugin and the VSCode extension find the YAML of a
 * clicked connection by the same key: the two must agree on every graph.
 */
describe("connectionKeys", () => {
  it("names connections exactly as the embed's protocol does", () => {
    const connections = [
      { source: "a", target: "b", label: "calls" },
      { source: "a", target: "b", label: "calls" },
      { source: "a", target: "b", label: "reads" },
      { source: "b", target: "a" },
      { source: "b", target: "a", label: null },
      { source: "c", target: "c", label: "" },
    ];
    expect(connectionKeys(connections)).toEqual(protocolKeys(connections));
  });
});
