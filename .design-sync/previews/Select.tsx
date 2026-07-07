import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "structura";

export function Open() {
  return (
    <Select defaultValue="context" defaultOpen>
      <SelectTrigger style={{ width: 220 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <SelectGroup>
          <SelectLabel>Diagram level</SelectLabel>
          <SelectItem value="context">Context</SelectItem>
          <SelectItem value="container">Container</SelectItem>
          <SelectItem value="component">Component</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
