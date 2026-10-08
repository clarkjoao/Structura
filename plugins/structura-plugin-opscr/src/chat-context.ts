import { compileSources, type Diagnostic } from "opscr/core";
import {
  applyChatEdits,
  chatSystemPrompt,
  describeError,
  newErrors,
  parseChatReply,
  retryMessage,
} from "./chat";
import { OPSCR_SKILL } from "./generated/opscr-skill";
import type { SourceText } from "./patches";
import { text, type Locale } from "./pane/i18n";
import { getSession, onSessionChange, type PaneSession } from "./session";
import type { PluginChatContext } from "./types/plugin.types";

async function errorsOf(session: PaneSession, files: readonly SourceText[]): Promise<Diagnostic[]> {
  const config = session.config();
  const { result } = await compileSources({
    files: files.map((f) => ({ path: f.name, content: f.text })),
    ...(config ? { config: { path: config.name, content: config.text } } : {}),
  });
  return result.diagnostics;
}

/** Whether two file lists hold the same texts by name (a file missing counts as empty). */
function sameTexts(a: readonly SourceText[], b: readonly SourceText[]): boolean {
  const names = new Set([...a, ...b].map((f) => f.name));
  const textOf = (list: readonly SourceText[], name: string) =>
    list.find((f) => f.name === name)?.text ?? "";
  return [...names].every((name) => textOf(a, name) === textOf(b, name));
}

/**
 * The chat on a diagram bound to an opscr folder (plugin API 1.6): the skill and the manifests
 * as context; the model's documents applied as text patches, validated by opscr, and the
 * errors it introduced sent back for a fix. Applies only while the pane has the folder open.
 */
export function createChatContext(): PluginChatContext {
  /** A retry builds on the previous attempt's result, kept here between attempts. */
  const pending = new Map<string, SourceText[]>();

  const workingFiles = (session: PaneSession, attempt: number) =>
    (attempt > 0 ? pending.get(session.diagramId) : undefined) ?? session.manifests();

  return {
    id: "structura-plugin-opscr/chat",

    appliesTo: (diagramId) => getSession()?.diagramId === diagramId,

    // The chat names the folder and offers opscr edits while it applies (API 1.8).
    presentation({ diagramId, locale }) {
      const t = text(locale as Locale);
      const session = getSession();
      return {
        title: t.chatTitle(session?.diagramId === diagramId ? session.folderName : ""),
        subtitle: t.chatSubtitle,
        suggestions: t.chatSuggestions,
      };
    },

    subscribe: onSessionChange,

    systemPrompt({ diagramId, locale, attempt }) {
      const session = getSession();
      if (!session || session.diagramId !== diagramId) return "";
      return chatSystemPrompt(OPSCR_SKILL, workingFiles(session, attempt), locale);
    },

    async handleReply(reply, { diagramId, locale, attempt, maxAttempts }) {
      const t = text(locale as Locale);
      const session = getSession();
      if (!session || session.diagramId !== diagramId) return { reply: t.chatClosed };
      const edits = parseChatReply(reply);
      if (edits.documents.length === 0 && edits.deletes.length === 0) {
        pending.delete(diagramId);
        return { reply: edits.message || reply };
      }
      const original = session.manifests();
      const applied = applyChatEdits(workingFiles(session, attempt), edits);
      const fresh = newErrors(
        await errorsOf(session, original),
        await errorsOf(session, applied.files),
      );
      if (fresh.length > 0 && attempt < maxAttempts - 1) {
        pending.set(diagramId, applied.files);
        return { reply: edits.message, retry: retryMessage(fresh) };
      }
      pending.delete(diagramId);
      const changed = await session.apply(applied.files, [...applied.added, ...applied.replaced]);
      const summary = t.chatChanged(applied.added, applied.replaced, applied.deleted);
      const after = applied.files;
      const remaining =
        fresh.length > 0
          ? `\n\n${t.chatRemainingErrors}\n${fresh.map((d) => `- ${describeError(d)}`).join("\n")}`
          : "";
      return {
        reply:
          [edits.message, `${summary} ${t.chatUnsaved}`].filter(Boolean).join("\n\n") + remaining,
        preview: {
          ...changed,
          title: summary,
          // Undo the reply — only while the manifests are still exactly what it left, so
          // edits made since (typed, or from the canvas) are never thrown away.
          discard: async () => {
            const live = getSession();
            if (!live || live.diagramId !== diagramId) return t.chatClosed;
            if (!sameTexts(live.manifests(), after)) return t.chatDiscardEdited;
            const restored = after.map((f) => ({
              name: f.name,
              text: original.find((o) => o.name === f.name)?.text ?? "",
            }));
            await live.apply(restored, []);
          },
        },
      };
    },
  };
}
