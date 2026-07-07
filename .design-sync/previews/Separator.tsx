import { Separator } from "structura";

export function Horizontal() {
  return (
    <div style={{ maxWidth: 320 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Structura</div>
      <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
        Architecture diagrams as code
      </div>
      <Separator style={{ margin: "12px 0" }} />
      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
        <span>Docs</span>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <span>Guides</span>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <span>API</span>
      </div>
    </div>
  );
}
