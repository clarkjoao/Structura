import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Level } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import type { AddDiagramDialogProps } from "./dashboard.types";

export function AddDiagramDialog({ onClose, onAdd }: AddDiagramDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("context");
  const [domain, setDomain] = useState("");

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
        <h3 className="text-lg font-bold mb-4">{t("dashboard.addDiagramTitle")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dashboard.namePlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.c4Level")}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="context">{t("dashboard.levelContext")}</option>
              <option value="container">{t("dashboard.levelContainer")}</option>
              <option value="component">{t("dashboard.levelComponent")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("dashboard.domainOptional")}
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t("dashboard.domainPlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} size="sm">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (name.trim())
                onAdd(name.trim(), level, domain.trim() || undefined);
            }}
            disabled={!name.trim()}
            size="sm"
          >
            {t("dashboard.createDiagram")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
