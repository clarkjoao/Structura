import { describe, expect, it } from "vitest";
import { readReferenceSolution } from "./asl-fixtures";
import { parseAslDocuments } from "./parse-asl";

describe("parseAslDocuments", () => {
  it("reads every manifest of the reference solution, in file order", async () => {
    const result = await parseAslDocuments(readReferenceSolution());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.documents).toHaveLength(8);
    expect(result.documents.map((document) => document.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const kinds = result.documents.map((document) =>
      typeof document.value === "object" && document.value !== null
        ? (document.value as Record<string, unknown>).kind
        : undefined,
    );
    expect(kinds).toEqual([
      "ApplicationService",
      "Application",
      "Application",
      "Database",
      "Queue",
      "Topic",
      "BusinessRule",
      "Relationship",
    ]);
  });

  it("drops a trailing empty document without complaining", async () => {
    const result = await parseAslDocuments(
      "apiVersion: arquitetura.itau/v1\nkind: Queue\nmetadata:\n  name: q\nspec:\n  provider: SQS\n---\n",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.documents).toHaveLength(1);
  });

  it("reports the position of a malformed document", async () => {
    const result = await parseAslDocuments("kind: Queue\n---\nkind: [unclosed\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe("invalidYaml");
    expect(result.issues[0].params?.index).toBe(1);
  });

  it("reports an empty file as having no manifests", async () => {
    const result = await parseAslDocuments("# só um comentário\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([{ code: "noManifests" }]);
  });
});
