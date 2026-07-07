import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useWalkthroughActions, useWalkthroughs } from "../store/selectors/walkthroughs.selectors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KEY, keyIs } from "@/lib/keyboard-utils";

interface CreateWalkthroughModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWalkthroughModal({ open, onOpenChange }: CreateWalkthroughModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addWalkthrough, updateWalkthrough } = useWalkthroughActions();
  const walkthroughs = useWalkthroughs();

  const domainListId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const domainOptions = useMemo(() => {
    const domains = new Set<string>();
    for (const walkthrough of walkthroughs) {
      const value = walkthrough.domain?.trim();
      if (value) domains.add(value);
    }
    return [...domains].sort((a, b) => a.localeCompare(b));
  }, [walkthroughs]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setDomain("");
    setTags([]);
    setTagInput("");
  }, [open]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0;

  const addTagFromInput = useCallback(() => {
    const next = tagInput.trim();
    if (!next) return;
    setTags((previous) => (previous.includes(next) ? previous : [...previous, next]));
    setTagInput("");
  }, [tagInput]);

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!keyIs(event, KEY.ENTER)) return;
    event.preventDefault();
    addTagFromInput();
  };

  const removeTag = (tag: string) => {
    setTags((previous) => previous.filter((item) => item !== tag));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const walkthrough = addWalkthrough(
      trimmedName,
      description.trim() || undefined,
      domain.trim() || undefined,
    );
    updateWalkthrough(walkthrough.id, { tags });
    navigate(`/walkthroughs/${walkthrough.id}/edit`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("walkthroughs.create.title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="walkthrough-create-name"
              >
                {t("walkthroughs.create.name")}
              </label>
              <Input
                id="walkthrough-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("walkthroughs.create.namePlaceholder")}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="walkthrough-create-description"
              >
                {t("walkthroughs.create.description")}
              </label>
              <textarea
                id="walkthrough-create-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("walkthroughs.create.descriptionPlaceholder")}
                className="min-h-24 w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="walkthrough-create-domain"
              >
                {t("walkthroughs.create.domain")}
              </label>
              <Input
                id="walkthrough-create-domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder={t("walkthroughs.create.domainPlaceholder")}
                list={domainListId}
              />
              <datalist id={domainListId}>
                {domainOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="walkthrough-create-tags"
              >
                {t("walkthroughs.create.tags")}
              </label>
              {tags.length > 0 ? (
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-muted"
                        onClick={() => removeTag(tag)}
                        aria-label={t("common.close")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <Input
                id="walkthrough-create-tags"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagInputKeyDown}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("walkthroughs.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
