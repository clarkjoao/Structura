import { SAMPLE_FILES } from "./test-sample";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatContext } from "./chat-context";
import { hasManifest, type SourceText } from "./engine/patches";
import { openSession } from "./session";

const read = (name: string) => SAMPLE_FILES[name]!;
const SAMPLE: SourceText[] = Object.keys(SAMPLE_FILES)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((name) => ({ name, text: read(name) }));

const cache = (extra = "") =>
  `\`\`\`yaml file=commerce.opscr.yaml\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n${extra}\`\`\``;
const TOPIC =
  "```yaml file=commerce.opscr.yaml\napiVersion: opscr.dev/v1\nkind: Topic\nmetadata:\n  name: price-events\nspec:\n  provider: SNS\n  type: IntegrationEvent\n  description: Price changes\n```";

let close: (() => void) | undefined;
afterEach(() => close?.());

function bind() {
  let files = structuredClone(SAMPLE);
  const apply = vi.fn(async (next: readonly SourceText[], touched: readonly string[]) => {
    files = [...next];
    return { componentIds: touched.map((k) => `id:${k}`), connectionIds: [] };
  });
  close = openSession({
    diagramId: "d",
    folderName: "sample",
    manifests: () => files,
    config: () => ({ name: "opscr.config.yaml", text: read("opscr.config.yaml") }),
    apply,
  });
  return {
    apply,
    files: () => files,
    edit: (name: string, text: string) =>
      (files = files.map((f) => (f.name === name ? { ...f, text } : f))),
  };
}
const input = (attempt: number) => ({
  diagramId: "d",
  locale: "en" as const,
  attempt,
  maxAttempts: 3,
});

describe("opscr chat context", () => {
  it("applies only to the diagram whose folder is open", () => {
    const context = createChatContext();
    expect(context.appliesTo("d")).toBe(false);
    bind();
    expect(context.appliesTo("d")).toBe(true);
    expect(context.appliesTo("other")).toBe(false);
  });

  it("applies a valid change and says what changed", async () => {
    const context = createChatContext();
    const session = bind();
    const result = await context.handleReply(`Added it.\n\n${cache()}`, input(0));
    expect(result.retry).toBeUndefined();
    expect(result.reply).toContain("Added Cache/price-cache");
    expect(hasManifest(session.files(), { kind: "Cache", name: "price-cache" })).toBe(true);
  });

  it("sends new errors back, then applies the fix on top of the first attempt", async () => {
    const context = createChatContext();
    const session = bind();
    const first = await context.handleReply(`${TOPIC}\n${cache("  inventedField: 1\n")}`, input(0));
    expect(first.retry).toContain("inventedField");
    expect(session.apply).not.toHaveBeenCalled();
    expect(await context.systemPrompt(input(1))).toContain("price-events");

    const second = await context.handleReply(cache(), input(1));
    expect(second.retry).toBeUndefined();
    expect(hasManifest(session.files(), { kind: "Topic", name: "price-events" })).toBe(true);
    expect(
      session
        .files()
        .map((f) => f.text)
        .join(),
    ).not.toContain("inventedField");
  });

  it("applies anyway on the last attempt, listing what is still wrong", async () => {
    const context = createChatContext();
    const session = bind();
    const result = await context.handleReply(cache("  inventedField: 1\n"), input(2));
    expect(result.retry).toBeUndefined();
    expect(result.reply).toContain("inventedField");
    expect(session.apply).toHaveBeenCalledTimes(1);
  });

  it("passes a plain answer through untouched", async () => {
    const context = createChatContext();
    const session = bind();
    expect((await context.handleReply("orders-db is DynamoDB.", input(0))).reply).toBe(
      "orders-db is DynamoDB.",
    );
    expect(session.apply).not.toHaveBeenCalled();
  });
});

describe("chat reply preview (API 1.7)", () => {
  it("previews what the reply touched, and Discard restores the text before it", async () => {
    const context = createChatContext();
    const session = bind();
    const result = await context.handleReply(cache(), input(0));
    expect(result.preview?.componentIds).toEqual(["id:Cache/price-cache"]);
    expect(result.preview?.title).toContain("Cache/price-cache");
    expect(await result.preview!.discard!()).toBeUndefined();
    expect(session.files().map((f) => f.text)).toEqual(SAMPLE.map((f) => f.text));
  });

  it("refuses to discard once the manifests changed since", async () => {
    const context = createChatContext();
    const session = bind();
    const result = await context.handleReply(cache(), input(0));
    session.edit("shared.opscr.yaml", "# edited by hand\n");
    expect(await result.preview!.discard!()).toMatch(/changed after this reply/);
    expect(hasManifest(session.files(), { kind: "Cache", name: "price-cache" })).toBe(true);
  });

  it("empties a file the reply created when discarding", async () => {
    const context = createChatContext();
    const session = bind();
    const reply = cache().replace("file=commerce.opscr.yaml", "file=cache.opscr.yaml");
    const result = await context.handleReply(reply, input(0));
    expect(session.files().map((f) => f.name)).toContain("cache.opscr.yaml");
    await result.preview!.discard!();
    expect(session.files().find((f) => f.name === "cache.opscr.yaml")?.text).toBe("");
  });
});

describe("chat presentation (API 1.8)", () => {
  it("names the folder and tells the host when the session opens or closes", () => {
    const context = createChatContext();
    const listener = vi.fn();
    const unsubscribe = context.subscribe!(listener);
    bind();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(context.presentation!({ diagramId: "d", locale: "pt-BR" })).toMatchObject({
      title: "opscr · sample",
      subtitle: expect.stringContaining("manifestos"),
    });
    close?.();
    close = undefined;
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
