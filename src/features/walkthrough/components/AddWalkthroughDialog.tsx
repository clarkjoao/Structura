import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllFolders } from "@/features/diagram";

export interface NewWalkthroughDraft {
  title: string;
  description: string;
  folderId: string | null;
}

interface AddWalkthroughDialogProps {
  onClose: () => void;
  onCreate: (draft: NewWalkthroughDraft) => void;
  /** Folder to pre-select when the dialog opens. */
  defaultFolderId?: string | null;
}

const NO_FOLDER_VALUE = "__no_folder__";

export function AddWalkthroughDialog({
  onClose,
  onCreate,
  defaultFolderId = null,
}: AddWalkthroughDialogProps) {
  const { t } = useTranslation();
  const folders = useAllFolders();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  // Escape closes the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      folderId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">
          {t("walkthrough.create.title", "New walkthrough")}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("walkthrough.create.nameLabel", "Title")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                "walkthrough.create.namePlaceholder",
                "e.g. Onboarding flow",
              )}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("walkthrough.create.folderLabel", "Folder")}
            </label>
            <Select
              value={folderId ?? NO_FOLDER_VALUE}
              onValueChange={(v) => setFolderId(v === NO_FOLDER_VALUE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER_VALUE}>
                  {t("walkthrough.create.noFolder", "No folder")}
                </SelectItem>
                {sortedFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("walkthrough.create.descriptionLabel", "Description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "walkthrough.create.descriptionPlaceholder",
                "What is this walkthrough about?",
              )}
              className="min-h-20 w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} size="sm">
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={!title.trim()} size="sm">
            {t("walkthrough.create.submit", "Create walkthrough")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
