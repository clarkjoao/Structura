import { Plus, X } from "lucide-react";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindInspectorSection } from "@/features/diagram-kinds/kind.types";
import { FlowShapeIcon } from "@/features/canvas/nodes/ProcessNode/FlowShapeIcon";
import { cn } from "@/lib/utils";
import { runKindOutcome } from "../../../chrome/kindElementActions";
import { CommitField, PanelSection } from "../shell";
import { KindSelectField } from "./KindSelectField";

const CHOICE_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * The diagram kind's own inspector tab (spec guided-editing-surfaces): the
 * sections the kind returns, drawn as choice groups and label fields; each
 * pick or commit is the kind's edit, applied as one undo step.
 */
export function KindInspectorTab({ sections }: { sections: KindInspectorSection[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="kind-inspector">
      {sections.map((section) => {
        const title = resolveKindText(section.label);
        if (section.type === "tags") {
          return (
            <PanelSection key={section.id} title={title}>
              <div className="space-y-2" data-testid={`kind-inspector-${section.id}`}>
                {section.values.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {section.values.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs text-foreground"
                      >
                        {name}
                        <button
                          type="button"
                          aria-label={resolveKindText(section.removeLabel, { name })}
                          onClick={() => runKindOutcome(section.remove(name))}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  section.empty && (
                    <p className="text-[11px] text-muted-foreground">
                      {resolveKindText(section.empty)}
                    </p>
                  )
                )}
                <KindSelectField
                  title={title}
                  section={{
                    type: "select",
                    id: `${section.id}-add`,
                    label: section.label,
                    value: null,
                    placeholder: section.placeholder,
                    options: section.suggestions
                      .filter((name) => !section.values.includes(name))
                      .map((name) => ({
                        id: name,
                        label: name,
                        selected: false,
                        run: () => section.add(name),
                      })),
                    create: { label: section.addLabel, run: section.add },
                  }}
                />
              </div>
            </PanelSection>
          );
        }
        if (section.type === "select") {
          return (
            <PanelSection key={section.id} title={title}>
              <KindSelectField section={section} title={title} />
            </PanelSection>
          );
        }
        if (section.type === "choice") {
          return (
            <PanelSection key={section.id} title={title}>
              <div
                className="flex flex-wrap gap-1.5"
                role="radiogroup"
                aria-label={title}
                data-testid={`kind-inspector-${section.id}`}
              >
                {section.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role={option.creates ? undefined : "radio"}
                    aria-checked={option.creates ? undefined : option.selected}
                    onClick={() => {
                      if (!option.selected) runKindOutcome(option.run());
                    }}
                    className={cn(
                      CHOICE_CLASS,
                      option.selected
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : option.creates
                          ? "border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          : "border-border text-foreground hover:bg-muted",
                    )}
                  >
                    {option.creates && <Plus className="h-3.5 w-3.5" aria-hidden />}
                    {option.element?.flowShape && (
                      <FlowShapeIcon
                        shape={option.element.flowShape}
                        color="currentColor"
                        size={14}
                      />
                    )}
                    {resolveKindText(option.label)}
                  </button>
                ))}
              </div>
            </PanelSection>
          );
        }
        return (
          <PanelSection key={section.id} title={title}>
            {section.items.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {section.empty ? resolveKindText(section.empty) : "—"}
              </p>
            ) : (
              <div className="space-y-2" data-testid={`kind-inspector-${section.id}`}>
                {section.items.map((item) => (
                  <CommitField
                    key={item.id}
                    label={resolveKindText(item.title, item.values)}
                    value={item.label}
                    placeholder={item.placeholder && resolveKindText(item.placeholder)}
                    onCommit={(value) => {
                      if (value.trim() !== item.label.trim()) runKindOutcome(item.commit(value));
                    }}
                  />
                ))}
              </div>
            )}
          </PanelSection>
        );
      })}
    </div>
  );
}
