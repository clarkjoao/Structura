"use client";

import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCcw, Settings } from "lucide-react";
import type { DataMessagePartProps } from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { getLLMErrorI18nKey, isSettingsFixableError, type LLMError } from "@/features/llm/errors";
import { isErrorPart } from "@/features/llm/message-parts";
import { useChatActions } from "./chat-actions";

interface ErrorNoticeProps {
  error: LLMError;
  onRetry: () => void;
  onOpenSettings: () => void;
}

/** A failed turn, inside the conversation: the mode-aware message and what to do next. */
export function ErrorNotice({ error, onRetry, onOpenSettings }: ErrorNoticeProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="my-1 space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3"
    >
      <p className="flex items-start gap-2 text-xs font-medium text-destructive">
        <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t(getLLMErrorI18nKey(error), { status: error.status })}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={onRetry}
        >
          <RotateCcw aria-hidden className="h-3 w-3" />
          {t("llmChat.error.action.retry")}
        </Button>
        {isSettingsFixableError(error) ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={onOpenSettings}
          >
            <Settings aria-hidden className="h-3 w-3" />
            {t("llmChat.error.action.settings")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** assistant-ui renderer for the error data part. */
export function ErrorPartView({ data }: Pick<DataMessagePartProps, "data">) {
  const messageId = useAuiState((state) => state.message.id);
  const { rerun, openSettings } = useChatActions();
  if (!isErrorPart(data)) {
    return null;
  }
  return (
    <ErrorNotice
      error={data.error}
      onRetry={() => rerun(messageId)}
      onOpenSettings={openSettings}
    />
  );
}
