import { useMemo, useState } from "react";
import type { ActiveMention, MentionItem } from "@/features/llm";

const MENTION_TRIGGER_PATTERN = /(^|\s)@([^\s@]*)$/;

export type InputSegment =
  { kind: "text"; value: string } | { kind: "mention"; mentionId: string; label: string };

export interface UseMentionInputResult {
  segments: InputSegment[];
  setSegments: (segments: InputSegment[]) => void;
  syncToken: number;
  inputText: string;
  setInputText: (text: string) => void;
  isPickerOpen: boolean;
  mentionQuery: string;
  activeMentions: ActiveMention[];
  selectMention: (item: MentionItem) => void;
  removeMention: (mentionId: string) => void;
  dismissPicker: () => void;
  resolvedText: string;
  clearMentions: () => void;
}

interface MentionTrigger {
  segmentIndex: number;
  triggerIndex: number;
  triggerEndIndex: number;
  query: string;
}

const EMPTY_SEGMENTS: InputSegment[] = [{ kind: "text", value: "" }];

function normalizeSegments(inputSegments: InputSegment[]): InputSegment[] {
  const normalizedSegments: InputSegment[] = [];
  for (const segment of inputSegments) {
    if (segment.kind === "text") {
      const previousSegment = normalizedSegments[normalizedSegments.length - 1];
      if (previousSegment?.kind === "text") {
        previousSegment.value += segment.value;
      } else {
        normalizedSegments.push({ kind: "text", value: segment.value });
      }
    } else {
      normalizedSegments.push(segment);
    }
  }
  if (normalizedSegments.length === 0) {
    return [...EMPTY_SEGMENTS];
  }
  return normalizedSegments;
}

export function getMentionTriggerFromText(
  value: string,
): Omit<MentionTrigger, "segmentIndex"> | null {
  const match = value.match(MENTION_TRIGGER_PATTERN);
  if (!match) {
    return null;
  }
  const query = match[2] ?? "";
  const triggerIndex = value.length - query.length - 1;
  const triggerEndIndex = triggerIndex + 1 + query.length;
  return { triggerIndex, triggerEndIndex, query };
}

function getMentionTrigger(segments: InputSegment[]): MentionTrigger | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.kind !== "text") {
      continue;
    }
    const trigger = getMentionTriggerFromText(segment.value);
    if (!trigger) {
      continue;
    }
    return { segmentIndex: index, ...trigger };
  }
  return null;
}

function segmentsToInputText(segments: InputSegment[]): string {
  return segments
    .map((segment) => (segment.kind === "text" ? segment.value : `@${segment.label}`))
    .join("");
}

function segmentsToActiveMentions(segments: InputSegment[]): ActiveMention[] {
  const mentionMap = new Map<string, ActiveMention>();
  for (const segment of segments) {
    if (segment.kind === "mention") {
      mentionMap.set(segment.mentionId, {
        mentionId: segment.mentionId,
        label: segment.label,
      });
    }
  }
  return Array.from(mentionMap.values());
}

export function useMentionInput(): UseMentionInputResult {
  const [segments, setSegmentsState] = useState<InputSegment[]>([...EMPTY_SEGMENTS]);
  const [syncToken, setSyncToken] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const activeMentions = useMemo(() => segmentsToActiveMentions(segments), [segments]);

  const refreshMentionState = (nextSegments: InputSegment[]) => {
    const trigger = getMentionTrigger(nextSegments);
    if (!trigger) {
      setIsPickerOpen(false);
      setMentionQuery("");
      return;
    }
    setIsPickerOpen(true);
    setMentionQuery(trigger.query);
  };

  const setSegments = (nextSegments: InputSegment[]) => {
    const normalizedSegments = normalizeSegments(nextSegments);
    setSegmentsState(normalizedSegments);
    refreshMentionState(normalizedSegments);
  };

  const handleSetInputText = (text: string) => {
    setSegments([{ kind: "text", value: text }]);
  };

  const selectMention = (item: MentionItem) => {
    const trigger = getMentionTrigger(segments);
    if (!trigger) {
      return;
    }

    const sourceSegment = segments[trigger.segmentIndex];
    if (!sourceSegment || sourceSegment.kind !== "text") {
      return;
    }

    const textBeforeMention = sourceSegment.value.slice(0, trigger.triggerIndex);
    const textAfterMention = sourceSegment.value.slice(trigger.triggerEndIndex);
    const nextSegments: InputSegment[] = [
      ...segments.slice(0, trigger.segmentIndex),
      ...(textBeforeMention ? [{ kind: "text", value: textBeforeMention } as const] : []),
      { kind: "mention", mentionId: item.id, label: item.label },
      {
        kind: "text",
        value:
          textAfterMention.startsWith(" ") || textAfterMention === ""
            ? textAfterMention
            : ` ${textAfterMention}`,
      },
      ...segments.slice(trigger.segmentIndex + 1),
    ];

    setSegments(nextSegments);
    setSyncToken((previousToken) => previousToken + 1);
    setIsPickerOpen(false);
    setMentionQuery("");
  };

  const removeMention = (mentionId: string) => {
    const nextSegments = segments.filter(
      (segment) => segment.kind !== "mention" || segment.mentionId !== mentionId,
    );
    setSegments(nextSegments);
  };

  const dismissPicker = () => {
    setIsPickerOpen(false);
    setMentionQuery("");
  };

  const clearMentions = () => {
    setSegments([...EMPTY_SEGMENTS]);
    setSyncToken((previousToken) => previousToken + 1);
    setIsPickerOpen(false);
    setMentionQuery("");
  };

  const inputText = useMemo(() => segmentsToInputText(segments), [segments]);
  const resolvedText = useMemo(() => segmentsToInputText(segments), [segments]);

  return {
    segments,
    setSegments,
    syncToken,
    inputText,
    setInputText: handleSetInputText,
    isPickerOpen,
    mentionQuery,
    activeMentions,
    selectMention,
    removeMention,
    dismissPicker,
    resolvedText,
    clearMentions,
  };
}
