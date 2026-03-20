import { useState, useMemo } from "react";
import { ChevronsUpDown, X, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAllServices, useDiagramActions, ServiceSource } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { useTranslation } from "react-i18next";

interface ServiceRegistryComboboxProps {
  value: string | null;
  onChange: (serviceId: string | null) => void;
}

const ServiceRegistryCombobox = ({
  value,
  onChange,
}: ServiceRegistryComboboxProps) => {
  const { t } = useTranslation();
  const allServices = useAllServices();
  const { addService } = useDiagramActions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");

  const linked = useMemo(
    () => (value ? (allServices.find((s) => s.id === value) ?? null) : null),
    [value, allServices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allServices;
    return allServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [allServices, search]);

  const handleSelect = (svc: ServiceDefinition) => {
    onChange(svc.id);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const tags = newTags
      ? newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const created = addService({
      name,
      description: "",
      repositoryUrl: "",
      technology: [],
      tags,
      sources: [{ type: ServiceSource.Manual }],
    });
    onChange(created.id);
    setOpen(false);
    setSearch("");
    setShowCreate(false);
    setNewName("");
    setNewTags("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setShowCreate(false);
      setNewName("");
      setNewTags("");
      setSearch("");
    }
  };

  if (linked) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
        <span className="text-foreground truncate">{linked.name}</span>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t("serviceCombobox.unlinkAria")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span>{t("serviceCombobox.linkPrompt")}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        {showCreate ? (
          <div className="p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("serviceCombobox.createNewService")}
            </p>
            <input
              autoFocus
              type="text"
              placeholder={t("serviceCombobox.newServiceName")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowCreate(false);
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder={t("serviceCombobox.newServiceTags")}
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowCreate(false);
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                // onClick={handleCreate}
                disabled={true}
                // disabled={!newName.trim()}
                className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("serviceCombobox.createAndLink")}
              </button>
            </div>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("serviceCombobox.searchPlaceholder")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 && !search && (
                <CommandEmpty>{t("serviceCombobox.emptyRegistered")}</CommandEmpty>
              )}
              {filtered.length === 0 && search && (
                <CommandEmpty>
                  {t("serviceCombobox.noResultsFor", { query: search })}
                </CommandEmpty>
              )}
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((svc) => (
                    <CommandItem
                      key={svc.id}
                      value={svc.id}
                      onSelect={() => handleSelect(svc)}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm truncate">{svc.name}</span>
                        {svc.technology.length > 0 && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {svc.technology.join(", ")}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ServiceRegistryCombobox;
