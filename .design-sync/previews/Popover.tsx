import { Popover, PopoverTrigger, PopoverContent, Button, Label, Input } from "structura";

export function Open() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Dimensions</Button>
      </PopoverTrigger>
      <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} style={{ width: 240 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Node size</div>
          <div style={{ display: "grid", gap: 6 }}>
            <Label htmlFor="pw">Width</Label>
            <Input id="pw" defaultValue="480px" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Label htmlFor="ph">Height</Label>
            <Input id="ph" defaultValue="320px" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
