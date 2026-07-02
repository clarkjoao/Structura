import type { ActiveMention, MentionItem } from "./types";

export function serializeMentionItem(item: MentionItem): string {
  return item.serialized;
}

export function buildMentionContextBlock(
  mentions: ActiveMention[],
  allItems: MentionItem[],
): string {
  if (mentions.length === 0) {
    return "";
  }

  const mentionIds = new Set(mentions.map((mention) => mention.mentionId));
  const selectedItems = allItems.filter((item) => mentionIds.has(item.id));
  if (selectedItems.length === 0) {
    return "";
  }

  const lines = [
    "[SYSTEM: The following nodes/edges are explicitly referenced by the user for context]",
  ];
  for (const item of selectedItems) {
    lines.push(serializeMentionItem(item));
  }
  return lines.join("\n");
}
