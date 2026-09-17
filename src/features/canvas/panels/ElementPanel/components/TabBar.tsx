import { useTranslation } from "react-i18next";

export type Tab = "details" | "connections" | "services";

export interface TabBarProps {
  active: Tab;
  onChange: (next: Tab) => void;
  showConnections: boolean;
  showServices: boolean;
}

const TabBar = ({ active, onChange, showConnections, showServices }: TabBarProps) => {
  const { t } = useTranslation();
  const tabs: Tab[] = ["details"];
  if (showConnections) tabs.push("connections");
  if (showServices) tabs.push("services");

  const labelFor = (tab: Tab) => {
    if (tab === "details") return t("elementPanelTab.details");
    if (tab === "connections") return t("elementPanelTab.connections");
    return t("elementPanelTab.services");
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
