import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

export type Tab = "details" | "connections" | "services";

export interface TabBarProps {
  active: Tab;
  onChange: (next: Tab) => void;
  showConnections: boolean;
  showServices: boolean;
}

const TAB_LABELS: Record<Tab, string> = {
  details: "elementPanelTab.details",
  connections: "elementPanelTab.connections",
  services: "elementPanelTab.services",
};

const TabBar = ({ active, onChange, showConnections, showServices }: TabBarProps) => {
  const { t } = useTranslation();
  const tabs: Tab[] = ["details"];
  if (showConnections) tabs.push("connections");
  if (showServices) tabs.push("services");

  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex = currentIndex;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        onChange(nextTab);
        // Focus the next tab button for screen readers
        const buttons = tabListRef.current?.querySelectorAll('[role="tab"]');
        const nextButton = buttons?.[nextIndex] as HTMLButtonElement | undefined;
        nextButton?.focus();
      }
    },
    [tabs, onChange],
  );

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={t("elementPanelTab.listLabel")}
      className="flex border-b border-border"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`tab-${tab}`}
          aria-selected={active === tab}
          aria-controls={`tabpanel-${tab}`}
          tabIndex={active === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            active === tab
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(TAB_LABELS[tab])}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
