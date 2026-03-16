export type Tab = "details" | "connections";

const TabBar = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => (
  <div className="flex border-b border-border">
    {(["details", "connections"] as const).map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active === t
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t === "details" ? "Details" : "Connections"}
      </button>
    ))}
  </div>
);

export default TabBar;
