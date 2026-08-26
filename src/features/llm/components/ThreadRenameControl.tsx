import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

interface ThreadRenameControlProps {
  threadId: string;
  currentTitle: string;
  onRename: (threadId: string, title: string) => void;
}

export function ThreadRenameControl({
  threadId,
  currentTitle,
  onRename,
}: ThreadRenameControlProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== currentTitle) {
      onRename(threadId, trimmed);
    }
  };

  const handleOpen = () => {
    const initial = currentTitle;
    requestAnimationFrame(() => inputRef.current?.focus());
    setEditorState({ open: true, value: initial });
  };

  const [editorState, setEditorState] = useState<{
    open: boolean;
    value: string;
  } | null>(null);

  if (!editorState?.open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={t("llmChat.threads.rename")}
        title={t("llmChat.threads.rename")}
      >
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(editorState.value);
        setEditorState(null);
      }}
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={editorState.value}
        size={20}
        className="h-6 w-32 px-1 py-0.5 text-xs"
        placeholder={t("llmChat.threads.renamePlaceholder")}
        onChange={(event) =>
          setEditorState({ open: true, value: event.target.value })
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setEditorState(null);
          }
        }}
      />
    </form>
  );
}
