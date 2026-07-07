import { Checkbox, Label } from "structura";

export function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Checkbox id="c1" defaultChecked />
        <Label htmlFor="c1">Checked</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Checkbox id="c2" />
        <Label htmlFor="c2">Unchecked</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Checkbox id="c3" disabled />
        <Label htmlFor="c3">Disabled</Label>
      </div>
    </div>
  );
}
