import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DialogFooter } from "@/components/ui/dialog";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource, suggestServiceRole } from "@/features/diagram";
import type { ServiceRole } from "@/features/diagram";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { ChipInput } from "./ChipInput";
import { RoleSelect } from "./RoleSelect";

export const ManualCreateForm = ({
  onBack,
  onCancel,
  onCreate,
}: {
  onBack: () => void;
  onCancel: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState<ServiceRole | "">("");
  const suggested = suggestServiceRole({ name, repositoryUrl: "" });
  const [tech, setTech] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const submit = () => {
    if (!name.trim()) return;
    // A suggestion is stored as such so a later rename can still refresh it.
    const declared = role || suggested;
    onCreate({
      name: name.trim(),
      description: desc.trim(),
      repositoryUrl: "",
      technology: tech,
      owner: owner.trim() || undefined,
      ...(declared
        ? { role: declared, roleSource: role ? ("user" as const) : ("suggested" as const) }
        : {}),
      tags,
      sources: [{ type: ServiceSource.Manual }],
    });
  };

  const FIELD =
    "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const LABEL =
    "text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("services.batchBack")}
      </button>
      <div>
        <label htmlFor="manual-name" className={LABEL}>
          {t("common.name")}
        </label>
        <input
          id="manual-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => keyIs(e, KEY.ENTER) && submit()}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="manual-desc" className={LABEL}>
          {t("common.description")}
        </label>
        <textarea
          id="manual-desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className={`${FIELD} resize-none`}
        />
      </div>
      <RoleSelect value={role} suggested={suggested} onChange={setRole} />
      <div>
        <label htmlFor="manual-owner" className={LABEL}>
          {t("common.owner")} · {t("services.optional")}
        </label>
        <input
          id="manual-owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className={FIELD}
        />
      </div>
      <ChipInput
        label={t("common.technology")}
        items={tech}
        onChange={setTech}
        placeholder={t("services.techPlaceholder")}
      />
      <ChipInput
        label={t("common.tags")}
        items={tags}
        onChange={setTags}
        placeholder={t("services.tagsPlaceholder")}
      />
      <DialogFooter className="gap-2 pt-1 sm:space-x-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("services.addService")}
        </button>
      </DialogFooter>
    </div>
  );
};
