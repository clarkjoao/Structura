import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { compileSources } from "opscr/core";
import { describe, expect, it } from "vitest";
import { applyChatEdits, chatSystemPrompt, newErrors, parseChatReply, retryMessage } from "./chat";
import { countEdges, hasManifest, type SourceText } from "./patches";

const sampleDir = join(
  dirname(createRequire(import.meta.url).resolve("opscr/package.json")),
  "examples/sample",
);
const SAMPLE: SourceText[] = readdirSync(sampleDir)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(sampleDir, name), "utf8") }));
const CONFIG = {
  path: "opscr.config.yaml",
  content: readFileSync(join(sampleDir, "opscr.config.yaml"), "utf8"),
};
const diagnostics = async (files: SourceText[]) =>
  (
    await compileSources({
      files: files.map((f) => ({ path: f.name, content: f.text })),
      config: CONFIG,
    })
  ).result.diagnostics;
const text = (files: SourceText[], name: string) => files.find((f) => f.name === name)!.text;

const CACHE_REPLY = `Added a Redis cache for prices, read by catalog-api.

\`\`\`yaml file=commerce.opscr.yaml
apiVersion: opscr.dev/v1
kind: Cache
metadata:
  name: price-cache
spec:
  provider: ElastiCache Redis
  description: "Current prices"
\`\`\`
`;

describe("parseChatReply", () => {
  it("separates the prose, the documents and the deletions", () => {
    const parsed = parseChatReply(
      `${CACHE_REPLY}\n\`\`\`opscr-delete\nCache/cart-cache\nnot a key\n\`\`\`\n\`\`\`yaml\nkind: Queue\nmetadata: { name: q }\n---\nkind: Topic\nmetadata: { name: t }\n\`\`\``,
    );
    expect(parsed.message).toBe("Added a Redis cache for prices, read by catalog-api.");
    expect(parsed.documents.map((d) => d.file)).toEqual([
      "commerce.opscr.yaml",
      undefined,
      undefined,
    ]);
    expect(parsed.documents[2]!.source).toContain("kind: Topic");
    expect(parsed.deletes).toEqual([{ kind: "Cache", name: "cart-cache" }]);
  });

  it("leaves other code blocks in the prose", () => {
    expect(parseChatReply("See:\n```bash\nopscr compile\n```").message).toContain("opscr compile");
  });
});

describe("applyChatEdits", () => {
  it("appends a new manifest to the named file, other files untouched", () => {
    const applied = applyChatEdits(SAMPLE, parseChatReply(CACHE_REPLY));
    expect(applied.added).toEqual(["Cache/price-cache"]);
    expect(text(applied.files, "commerce.opscr.yaml")).toBe(
      `${text(SAMPLE, "commerce.opscr.yaml")}---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: "Current prices"\n`,
    );
    expect(text(applied.files, "relationships.opscr.yaml")).toBe(
      text(SAMPLE, "relationships.opscr.yaml"),
    );
  });

  it("replaces an existing manifest in place, keeping the bytes around it", () => {
    const reply =
      '```yaml file=commerce.opscr.yaml\napiVersion: opscr.dev/v1\nkind: Database\nmetadata:\n  name: orders-db\nspec:\n  provider: AuroraPostgres\n  description: "Orders"\n```';
    const applied = applyChatEdits(SAMPLE, parseChatReply(reply));
    expect(applied.replaced).toEqual(["Database/orders-db"]);
    const before = text(SAMPLE, "commerce.opscr.yaml");
    const after = text(applied.files, "commerce.opscr.yaml");
    const start = before.indexOf(
      "apiVersion: opscr.dev/v1\nkind: Database\nmetadata:\n  name: orders-db",
    );
    expect(after.slice(0, start)).toBe(before.slice(0, start));
    expect(after).toContain("  name: orders-db\nspec:\n  provider: AuroraPostgres");
    const tail = before.slice(before.indexOf("kind: Database\nmetadata:\n  name: catalog-db") - 30);
    expect(after.endsWith(tail)).toBe(true);
  });

  it("deletes manifests with their edges, and creates a new file", async () => {
    const reply = [
      "```opscr-delete\nCache/cart-cache\n```",
      "```yaml file=search.opscr.yaml\napiVersion: opscr.dev/v1\nkind: Application\nmetadata:\n  name: search-api\nspec:\n  provider: EKS\n  language: Go\n  description: Search\n```",
    ].join("\n");
    const applied = applyChatEdits(SAMPLE, parseChatReply(reply));
    expect(applied.deleted).toEqual(["Cache/cart-cache"]);
    expect(hasManifest(applied.files, { kind: "Cache", name: "cart-cache" })).toBe(false);
    expect(applied.files.map((f) => f.name)).toContain("search.opscr.yaml");
    expect(newErrors(await diagnostics(SAMPLE), await diagnostics(applied.files))).toEqual([]);
  });

  it("a rewritten Relationship changes its edges", () => {
    const rel = text(SAMPLE, "relationships.opscr.yaml");
    const start = rel.indexOf(
      "apiVersion: opscr.dev/v1\nkind: Relationship\nmetadata:\n  name: entry-relationships",
    );
    const end = rel.indexOf("---", start);
    const doc = rel
      .slice(start, end)
      .replace(
        "    - from: { kind: Channel, id: store-app }\n      to: { kind: APIGateway, id: public-api }\n      type: calls\n",
        "",
      );
    const applied = applyChatEdits(
      SAMPLE,
      parseChatReply(`\`\`\`yaml file=relationships.opscr.yaml\n${doc}\`\`\``),
    );
    const edge = {
      from: { kind: "Channel", name: "store-app" },
      to: { kind: "APIGateway", name: "public-api" },
      type: "calls",
    };
    expect(countEdges(SAMPLE, edge)).toBe(1);
    expect(countEdges(applied.files, edge)).toBe(0);
  });
});

describe("validation loop", () => {
  it("reports only the errors the change introduced", async () => {
    const reply =
      "```yaml file=commerce.opscr.yaml\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: bad-cache\nspec:\n  provider: ElastiCache Redis\n  description: x\n  inventedField: 1\n```";
    const applied = applyChatEdits(SAMPLE, parseChatReply(reply));
    const fresh = newErrors(await diagnostics(SAMPLE), await diagnostics(applied.files));
    expect(fresh).toHaveLength(1);
    expect(retryMessage(fresh)).toContain("inventedField");
  });

  it("puts the skill and the manifests in the system prompt", () => {
    const prompt = chatSystemPrompt({ "SKILL.md": "# opscr skill" }, SAMPLE, "pt-BR");
    expect(prompt).toContain('<skill-file path="SKILL.md">');
    expect(prompt).toContain('<file name="commerce.opscr.yaml">');
    expect(prompt).toContain("Brazilian Portuguese");
  });
});
