import { Badge } from "structura";

export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  );
}

export function InContext() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Badge variant="secondary">v0.1.0</Badge>
      <Badge>Active</Badge>
      <Badge variant="destructive">3 errors</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  );
}
