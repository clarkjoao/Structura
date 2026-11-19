import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  importDrawioFile,
  isWorkspaceFile,
  notArchitecturePages,
  reviewItems,
} from "./import-drawio";

const AWS = readFileSync(
  "node_modules/opscr/tests/import/corpus/vendor/aws/example-microservices.drawio",
  "utf8",
);

describe("importDrawioFile", () => {
  it("brings the workspace as top-level files, with its review list", async () => {
    const result = await importDrawioFile(AWS, "example-microservices.drawio");
    const names = result.files.map((f) => f.name).sort();
    expect(names).toEqual([
      "IMPORT-SUMMARY.md",
      "analysis.json",
      "example-microservices.opscr.yaml",
      "opscr.layout.json",
      "opscr.visual.json",
      "relationships.opscr.yaml",
    ]);
    expect(result.skippedPages).toEqual([]);
    const review = reviewItems(result.files);
    expect(review.map((r) => r.key)).toContain("Database/payments-data");
    expect(review.find((r) => r.key === "Database/payments-data")!.evidence).toMatch(
      /defaulted: provider/,
    );
    expect(notArchitecturePages(result.files)).toEqual([]);
  });

  it("brings the first architecture page of a several-page drawing and names the others", async () => {
    const page = (name: string, label: string) =>
      `<diagram id="${name}" name="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="${label}" style="rounded=0;" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram>`;
    const result = await importDrawioFile(
      `<mxfile>${page("Overview", "Orders API")}${page("Detail", "Billing API")}</mxfile>`,
      "two.drawio",
    );
    expect(result.files.some((f) => f.name.includes("/"))).toBe(false);
    expect(
      result.files.find((f) => f.name.endsWith(".opscr.yaml") && f.text.includes("orders-api")),
    ).toBeDefined();
    expect(result.skippedPages).toEqual(["Detail"]);
  });

  it("a file with no diagram writes nothing", async () => {
    const result = await importDrawioFile("\u0089PNG not a diagram", "fake.drawio");
    expect(result).toMatchObject({ files: [], problem: "no-diagram" });
  });

  it("knows the files of an existing workspace", () => {
    expect(isWorkspaceFile("shop.opscr.yaml")).toBe(true);
    expect(isWorkspaceFile("opscr.visual.json")).toBe(true);
    expect(isWorkspaceFile("README.md")).toBe(false);
  });
});
