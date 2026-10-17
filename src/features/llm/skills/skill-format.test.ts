import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SKILL_LIMITS,
  isSkillParseFailure,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  skillFileStem,
  type SkillParseResult,
} from "./skill-format";

const VALID = `---
name: Revisão AWS
description: Revisar diagramas com serviços AWS
tools: [get_diagram_summary, get_node_details, search_elements, update_node]
---
Avalie cada serviço pelos 6 pilares do Well-Architected...
`;

function fields(result: SkillParseResult) {
  if (isSkillParseFailure(result)) throw new Error(`unexpected error ${result.error.code}`);
  return result.fields;
}

function error(result: SkillParseResult) {
  if (!isSkillParseFailure(result)) throw new Error("expected a parse error");
  return result.error;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSkillMarkdown", () => {
  it("reads a valid file", () => {
    expect(fields(parseSkillMarkdown(VALID))).toEqual({
      name: "Revisão AWS",
      description: "Revisar diagramas com serviços AWS",
      instructions: "Avalie cada serviço pelos 6 pilares do Well-Architected...",
      tools: ["get_diagram_summary", "get_node_details", "search_elements", "update_node"],
    });
  });

  it("treats a missing tools key as every tool", () => {
    const parsed = fields(parseSkillMarkdown("---\nname: A\ndescription: B\n---\nDo it."));
    expect(parsed.tools).toBeUndefined();
  });

  it("reads a block list, quoted strings and comments", () => {
    const text = [
      "---",
      "# a comment",
      'name: "Review: AWS"',
      "description: 'It''s for AWS' # trailing comment",
      "tools:",
      "  - get_node_details",
      '  - "search_elements"',
      "---",
      "Body",
    ].join("\r\n");
    expect(fields(parseSkillMarkdown(text))).toEqual({
      name: "Review: AWS",
      description: "It's for AWS",
      instructions: "Body",
      tools: ["get_node_details", "search_elements"],
    });
  });

  it("reads a flow list with quoted items and a trailing comma", () => {
    const parsed = fields(
      parseSkillMarkdown("---\nname: A\ndescription: B\ntools: [a, 'b', \"c\",]\n---\n"),
    );
    expect(parsed.tools).toEqual(["a", "b", "c"]);
  });

  it("reports a missing required field with its line", () => {
    expect(error(parseSkillMarkdown("---\nname: A\n---\nbody"))).toEqual({
      line: 1,
      code: "missingField",
      field: "description",
    });
    expect(error(parseSkillMarkdown("---\nname:\ndescription: B\n---\n"))).toMatchObject({
      line: 2,
      code: "missingField",
      field: "name",
    });
  });

  it("reports a file without front matter", () => {
    expect(error(parseSkillMarkdown("# Just markdown"))).toMatchObject({
      line: 1,
      code: "missingFrontmatter",
    });
    expect(error(parseSkillMarkdown("---\nname: A\n"))).toMatchObject({
      code: "unclosedFrontmatter",
    });
  });

  it("reports values over the limits instead of truncating", () => {
    const longName = "n".repeat(SKILL_LIMITS.name + 1);
    expect(error(parseSkillMarkdown(`---\nname: ${longName}\ndescription: B\n---\n`))).toEqual({
      line: 2,
      code: "tooLong",
      field: "name",
      max: SKILL_LIMITS.name,
    });

    const longDescription = "d".repeat(SKILL_LIMITS.description + 1);
    expect(
      error(parseSkillMarkdown(`---\nname: A\ndescription: ${longDescription}\n---\n`)),
    ).toMatchObject({ line: 3, code: "tooLong", field: "description" });

    const longBody = "i".repeat(SKILL_LIMITS.instructions + 1);
    expect(
      error(parseSkillMarkdown(`---\nname: A\ndescription: B\n---\n${longBody}`)),
    ).toMatchObject({ line: 5, code: "tooLong", field: "instructions" });

    const huge = `---\nname: A\ndescription: B\n---\n${"x".repeat(SKILL_LIMITS.file)}`;
    expect(error(parseSkillMarkdown(huge))).toMatchObject({ code: "fileTooLarge" });
  });

  it("ignores unknown keys with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseSkillMarkdown("---\nname: A\nversion: 2\ndescription: B\n---\nx");
    expect(isSkillParseFailure(result)).toBe(false);
    if (!isSkillParseFailure(result)) {
      expect(result.fields).not.toHaveProperty("version");
      expect(result.warnings).toEqual([{ line: 3, code: "unknownKey", field: "version" }]);
    }
    expect(warn).toHaveBeenCalled();
  });

  it("rejects malformed lines, lists and duplicates", () => {
    expect(error(parseSkillMarkdown("---\nname A\ndescription: B\n---\n"))).toMatchObject({
      line: 2,
      code: "invalidLine",
    });
    expect(
      error(parseSkillMarkdown("---\nname: A\ndescription: B\ntools: [a,, b]\n---\n")),
    ).toMatchObject({ line: 4, code: "invalidList" });
    expect(error(parseSkillMarkdown("---\nname: A\nname: B\ndescription: C\n---\n"))).toMatchObject(
      { line: 3, code: "duplicateKey", field: "name" },
    );
    expect(error(parseSkillMarkdown("---\nname: [a]\ndescription: C\n---\n"))).toMatchObject({
      line: 2,
      code: "invalidValue",
      field: "name",
    });
    expect(
      error(parseSkillMarkdown("---\nname: A\ndescription: C\ntools: get_x\n---\n")),
    ).toMatchObject({ line: 4, code: "invalidValue", field: "tools" });
  });
});

describe("serializeSkillMarkdown", () => {
  it("round-trips", () => {
    const original = fields(parseSkillMarkdown(VALID));
    const text = serializeSkillMarkdown(original);
    expect(fields(parseSkillMarkdown(text))).toEqual(original);
    expect(serializeSkillMarkdown(fields(parseSkillMarkdown(text)))).toBe(text);
  });

  it("quotes values that would not read back as plain strings", () => {
    const tricky = {
      name: "Review: AWS #1",
      description: "- starts with a dash",
      instructions: "Line one\n\nLine two",
      tools: ["get_node_details", "mcp server/tool name"],
    };
    const text = serializeSkillMarkdown(tricky);
    expect(fields(parseSkillMarkdown(text))).toEqual(tricky);
  });

  it("omits an empty tools list", () => {
    const text = serializeSkillMarkdown({
      name: "A",
      description: "B",
      instructions: "",
      tools: [],
    });
    expect(text).toBe("---\nname: A\ndescription: B\n---\n");
  });
});

describe("skillFileStem", () => {
  it("makes a safe file name from the skill name", () => {
    expect(skillFileStem("Revisão AWS!")).toBe("revisao-aws");
    expect(skillFileStem("***")).toBe("skill");
  });
});
