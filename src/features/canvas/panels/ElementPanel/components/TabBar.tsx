import { useTranslation } from "react-i18next";

export type Tab = "details" | "connections";

const TabBar = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => {
  const { t } = useTranslation();
  return (
  <div className="flex border-b border-border">
    {(["details", "connections"] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active === tab
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {tab === "details" ? t("elementPanelTab.details") : t("elementPanelTab.connections")}
      </button>
    ))}
  </div>
  );
};

export default TabBar;
