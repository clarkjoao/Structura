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
import { getSession, type PaneSession } from "./session";
import type { PluginChatContext } from "./types/plugin.types";

async function errorsOf(session: PaneSession, files: readonly SourceText[]): Promise<Diagnostic[]> {
  const config = session.config();
  const { result } = await compileSources({
    files: files.map((f) => ({ path: f.name, content: f.text })),
    ...(config ? { config: { path: config.name, content: config.text } } : {}),
  });
  return result.diagnostics;
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
      session.apply(applied.files);
      const summary = t.chatChanged(applied.added, applied.replaced, applied.deleted);
      const remaining =
        fresh.length > 0
          ? `\n\n${t.chatRemainingErrors}\n${fresh.map((d) => `- ${describeError(d)}`).join("\n")}`
          : "";
      return { reply: [edits.message, summary].filter(Boolean).join("\n\n") + remaining };
    },
  };
}
