import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Plus, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindInspectorSelect } from "@/features/diagram-kinds/kind.types";
import { cn } from "@/lib/utils";
import { runKindOutcome } from "../../../chrome/kindElementActions";

/**
 * A kind's select-or-create field (e.g. a step's phase): the existing values,
 * filtered by the typed text, and "create" for text that names none of them.
 */
export function KindSelectField({
  section,
  title,
}: {
  section: KindInspectorSelect;
  title: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim();
  const lower = query.toLowerCase();
  const options = section.options.filter((o) => !lower || o.label.toLowerCase().includes(lower));
  const exact = section.options.some((o) => o.label.toLowerCase() === lower);
  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          data-testid={`kind-inspector-${section.id}`}
          className="flex h-8 w-full items-center justify-between rounded-md border border-border bg-secondary px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={cn("truncate", section.value === null && "text-muted-foreground")}>
            {section.value ?? resolveKindText(section.placeholder)}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("diagramKinds.inspector.selectSearch")}
            value={search}
            onValueChange={setSearch}
            data-testid={`kind-inspector-${section.id}-search`}
          />
          <CommandList>
            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      if (!option.selected) runKindOutcome(option.run());
                      close();
                    }}
                  >
                    <Check
                      className={cn("h-3.5 w-3.5", option.selected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(query && !exact) || section.clear ? (
              <CommandGroup>
                {query && !exact && (
                  <CommandItem
                    value="__create__"
                    data-testid={`kind-inspector-${section.id}-create`}
                    onSelect={() => {
                      runKindOutcome(section.create.run(query));
                      close();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {resolveKindText(section.create.label, { name: query })}
                  </CommandItem>
                )}
                {section.clear && !query && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      runKindOutcome(section.clear!.run());
                      close();
                    }}
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden />
                    {resolveKindText(section.clear.label)}
                  </CommandItem>
                )}
              </CommandGroup>
            ) : null}
            {options.length === 0 && !query && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("diagramKinds.inspector.selectEmpty")}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
