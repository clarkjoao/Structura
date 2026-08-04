/**
 * Entry point for the IR generation pipeline from the chat input.
 *
 * Generation is an explicit command rather than an inferred intent: the existing
 * chat produces incremental patches for an existing diagram, and guessing which
 * of the two the user meant would make both less predictable.
 */
const GENERATE_COMMAND_PATTERN = /^\/(?:generate|gerar)\b[ \t]*([\s\S]*)$/i;

export interface GenerateCommand {
  /** What to generate. Empty when the user typed the bare command. */
  description: string;
}

export function parseGenerateCommand(text: string): GenerateCommand | null {
  const match = GENERATE_COMMAND_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  return { description: (match[1] ?? "").trim() };
}
