import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "structura";

export function Default() {
  return (
    <Command style={{ maxWidth: 380, border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            New diagram
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>Search components</CommandItem>
          <CommandItem>Open recent</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            Preferences
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
