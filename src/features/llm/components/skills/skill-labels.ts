import type { SkillParseError, SkillParseErrorCode } from "../../skills/skill-format";
import type { ToolKind } from "../../tools/registry";

const PARSE_ERROR_KEYS: Record<SkillParseErrorCode, string> = {
  fileTooLarge: "llmChat.skills.error.fileTooLarge",
  missingFrontmatter: "llmChat.skills.error.missingFrontmatter",
  unclosedFrontmatter: "llmChat.skills.error.unclosedFrontmatter",
  invalidLine: "llmChat.skills.error.invalidLine",
  duplicateKey: "llmChat.skills.error.duplicateKey",
  invalidValue: "llmChat.skills.error.invalidValue",
  invalidList: "llmChat.skills.error.invalidList",
  missingField: "llmChat.skills.error.missingField",
  tooLong: "llmChat.skills.error.tooLong",
};

/** A parse error as the user reads it: "Line N: reason". */
export function formatSkillParseError(
  error: SkillParseError,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const reason = t(PARSE_ERROR_KEYS[error.code], {
    field: error.field ?? "",
    max: error.max ?? 0,
  });
  return t("llmChat.skills.settings.problemLine", { line: error.line, reason });
}

export const TOOL_KIND_LABEL_KEYS: Record<ToolKind, string> = {
  read: "llmChat.skills.settings.toolKind.read",
  write: "llmChat.skills.settings.toolKind.write",
};
