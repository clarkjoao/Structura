import { Switch, Label } from "structura";

export function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Switch id="s1" defaultChecked />
        <Label htmlFor="s1">Auto-save enabled</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Switch id="s2" />
        <Label htmlFor="s2">Public sharing</Label>
      </div>
    </div>
  );
}
