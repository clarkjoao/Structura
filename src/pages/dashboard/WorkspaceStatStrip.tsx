import { useTranslation } from "react-i18next";
import type { WorkspaceStats } from "@/pages/dashboard/workspaceStats";

interface WorkspaceStatStripProps {
  stats: WorkspaceStats;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function WorkspaceStatStrip({ stats }: WorkspaceStatStripProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <StatCard label={t("dashboard.stats.diagrams")} value={stats.diagramCount} />
      <StatCard label={t("dashboard.stats.components")} value={stats.componentCount} />
      <StatCard label={t("dashboard.stats.flows")} value={stats.flowCount} />
    </div>
  );
}
