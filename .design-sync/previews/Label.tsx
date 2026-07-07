import { Label, Input, Checkbox } from "structura";

export function WithInput() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 300 }}>
      <Label htmlFor="api-key">API key</Label>
      <Input id="api-key" placeholder="sk-…" />
    </div>
  );
}

export function WithCheckbox() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Checkbox id="terms" defaultChecked />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  );
}
