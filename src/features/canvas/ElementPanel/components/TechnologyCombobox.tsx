import { useState, useMemo } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const TECHNOLOGY_OPTIONS: { group: string; options: string[] }[] = [
  { group: "Sync", options: ["REST", "gRPC", "GraphQL", "SOAP"] },
  { group: "Async", options: ["Kafka", "RabbitMQ", "SQS", "SNS", "EventBridge", "NATS"] },
  { group: "Streaming", options: ["WebSocket", "SSE", "gRPC Stream"] },
  { group: "Infra", options: ["TCP", "UDP", "AMQP", "MQTT"] },
];

const TechnologyCombobox = ({ value, onSelect }: { value: string; onSelect: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const allOptions = useMemo(() => TECHNOLOGY_OPTIONS.flatMap((g) => g.options), []);
  const hasMatch = search.trim() === "" || allOptions.some((o) => o.toLowerCase().includes(search.trim().toLowerCase()));
  const customOption = search.trim() && !hasMatch ? search.trim() : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <span className={value ? undefined : "text-muted-foreground"}>{value || "Selecionar tecnologia..."}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar..." value={search} onValueChange={setSearch} />
          <CommandList>
            {customOption && (
              <CommandGroup heading="Personalizado">
                <CommandItem value={`__custom__${customOption}`} onSelect={() => { onSelect(customOption); setOpen(false); setSearch(""); }}>
                  Usar &ldquo;{customOption}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            {TECHNOLOGY_OPTIONS.map((group) => {
              const filtered = group.options.filter((o) => !search.trim() || o.toLowerCase().includes(search.trim().toLowerCase()));
              if (filtered.length === 0) return null;
              return (
                <CommandGroup key={group.group} heading={group.group}>
                  {filtered.map((opt) => (
                    <CommandItem key={opt} value={opt} onSelect={() => { onSelect(opt); setOpen(false); setSearch(""); }}>
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TechnologyCombobox;
