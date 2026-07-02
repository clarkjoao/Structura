import { useTranslation } from "react-i18next";

export type Tab = "details" | "connections" | "icon";

export interface TabBarProps {
  active: Tab;
  onChange: (next: Tab) => void;
  showConnections: boolean;

  showIconTab?: boolean;
}

const TabBar = ({ active, onChange, showConnections, showIconTab = true }: TabBarProps) => {
  const { t } = useTranslation();
  const tabs = (
    showConnections ? (["details", "connections", "icon"] as const) : (["details", "icon"] as const)
  ).filter((tab) => showIconTab || tab !== "icon");

  const labelFor = (tab: (typeof tabs)[number]) => {
    if (tab === "details") return t("elementPanelTab.details");
    if (tab === "connections") return t("elementPanelTab.connections");
    return t("elementPanel.tabs.icon");
  };

  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            active === tab
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labelFor(tab)}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
