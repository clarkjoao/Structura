import { Input, Label } from "structura";

export function Default() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 300 }}>
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  );
}

export function WithValue() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 300 }}>
      <Label htmlFor="name">Workspace name</Label>
      <Input id="name" defaultValue="Structura Core" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 300 }}>
      <Input placeholder="Disabled" disabled />
    </div>
  );
}
