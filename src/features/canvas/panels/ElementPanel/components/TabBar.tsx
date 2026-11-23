import { useTranslation } from "react-i18next";

export type Tab = "kind" | "details" | "connections" | "services";

export interface TabBarProps {
  active: Tab;
  onChange: (next: Tab) => void;
  showConnections: boolean;
  showServices: boolean;
  /** The diagram kind's own tab (spec guided-editing-surfaces), first when present. */
  kindTab?: string;
}

const TabBar = ({ active, onChange, showConnections, showServices, kindTab }: TabBarProps) => {
  const { t } = useTranslation();
  const tabs: Tab[] = kindTab ? ["kind", "details"] : ["details"];
  if (showConnections) tabs.push("connections");
  if (showServices) tabs.push("services");

  const labelFor = (tab: Tab) => {
    if (tab === "kind") return kindTab ?? "";
    if (tab === "details") return t("elementPanelTab.details");
    if (tab === "connections") return t("elementPanelTab.connections");
    return t("elementPanelTab.services");
  };

  return (
    <div className="flex shrink-0 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={active === tab}
          data-testid={`element-tab-${tab}`}
          onClick={() => onChange(tab)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
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
