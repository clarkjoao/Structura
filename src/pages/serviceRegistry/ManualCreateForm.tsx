import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { ChipInput } from "./ChipInput";

export const ManualCreateForm = ({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState("");
  const [tech, setTech] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: desc.trim(),
      repositoryUrl: "",
      technology: tech,
      owner: owner.trim() || undefined,
      tags,
      sources: [{ type: ServiceSource.Manual }],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("registry.newService")}
      </p>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          {t("common.name")}
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          {t("common.description")}
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          {t("common.owner")}
        </label>
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <ChipInput
        label={t("common.technology")}
        items={tech}
        onChange={setTech}
        placeholder={t("registry.techPlaceholder")}
      />
      <ChipInput
        label={t("common.tags")}
        items={tags}
        onChange={setTags}
        placeholder={t("registry.tagsPlaceholder")}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("registry.createService")}
        </button>
      </div>
    </motion.div>
  );
};
