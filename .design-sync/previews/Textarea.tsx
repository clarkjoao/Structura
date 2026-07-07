import { Textarea, Label } from "structura";

export function Default() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 340 }}>
      <Label htmlFor="notes">Description</Label>
      <Textarea
        id="notes"
        defaultValue="This service handles authentication and issues short-lived session tokens."
        rows={4}
      />
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Textarea placeholder="Add a note about this component…" rows={3} />
    </div>
  );
}
