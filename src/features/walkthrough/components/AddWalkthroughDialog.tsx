import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Folder as FolderIcon, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFolders } from "@/features/diagram";

export interface NewWalkthroughDraft {
  title: string;
  description?: string;
  folderId: string | null;
}

interface AddWalkthroughDialogProps {
  onClose: () => void;
  onCreate: (draft: NewWalkthroughDraft) => void;
  /** Folder the new walkthrough will be created in. Required — the dialog
   *  doesn't let the user choose a folder, it inherits the one currently
   *  selected in the library's folder tree. `null` means "no folder" (root). */
  folderId: string | null;
}

export function AddWalkthroughDialog({ onClose, onCreate, folderId }: AddWalkthroughDialogProps) {
  const { t } = useTranslation();
  const folders = useFolders();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Escape closes the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const targetFolder = folderId ? folders[folderId] : null;
  const targetLabel = targetFolder ? targetFolder.name : t("walkthrough.create.noFolder");

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
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
        <h3 className="mb-4 text-lg font-bold">{t("walkthrough.create.title")}</h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("walkthrough.create.nameLabel")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("walkthrough.create.namePlaceholder")}
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
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              htmlFor="walkthrough-description"
            >
              {t("walkthrough.description")}{" "}
              <span className="font-normal normal-case tracking-normal">
                {t("walkthrough.optional")}
              </span>
            </label>
            <textarea
              id="walkthrough-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("walkthrough.descriptionPlaceholder")}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Read-only "creating in" hint — folder is determined by what's
              currently selected in the library's folder tree. */}
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {targetFolder ? (
              <FolderIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Home className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">
              {t("walkthrough.create.creatingIn", `Creating in ${targetLabel}`, {
                folder: targetLabel,
              })}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} size="sm">
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={!title.trim()} size="sm">
            {t("walkthrough.create.submit")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
