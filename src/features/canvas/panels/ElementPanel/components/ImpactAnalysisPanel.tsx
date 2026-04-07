import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useImpactAnalysis } from "../../../hooks/useImpactAnalysis";
import type { Component, Connection } from "@/features/diagram";

export interface ImpactAnalysisPanelProps {
  nodeId: string;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelectConnection: (connectionId: string) => void;
}

function componentLabel(component: Component): string {
  return component.name?.trim().length ? component.name : component.id;
}

function connectionLabel(connection: Connection): string {
  const label = connection.label?.trim();
  return label && label.length > 0 ? label : connection.id;
}

export function ImpactAnalysisPanel({
  nodeId,
  onClose,
  onSelectNode,
  onSelectConnection,
}: ImpactAnalysisPanelProps) {
  const { t } = useTranslation();
  const impact = useImpactAnalysis(nodeId);
  const [transitiveOpen, setTransitiveOpen] = useState(false);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("impactAnalysis.title")}</SheetTitle>
        </SheetHeader>
        {!impact ? (
          <p className="text-sm text-muted-foreground">{t("impactAnalysis.unavailable")}</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 text-sm">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("impactAnalysis.directDependents")}
              </h4>
              {impact.directDependents.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("impactAnalysis.noDependents")}</p>
              ) : (
                <ul className="space-y-1">
                  {impact.directDependents.map((component) => (
                    <li key={component.id}>
                      <button
                        type="button"
                        className="text-left w-full rounded-md px-2 py-1.5 hover:bg-muted/80 text-foreground"
                        onClick={() => {
                          onSelectNode(component.id);
                          onClose();
                        }}
                      >
                        <span className="font-medium">{componentLabel(component)}</span>
                        <span className="text-muted-foreground text-xs ml-2">{component.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <Collapsible open={transitiveOpen} onOpenChange={setTransitiveOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-8">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("impactAnalysis.transitive")}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${transitiveOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {impact.transitiveDependents.length === 0 ? (
                    <p className="text-muted-foreground text-xs py-2">{t("impactAnalysis.noDependents")}</p>
                  ) : (
                    <ul className="space-y-1 pt-1">
                      {impact.transitiveDependents.map((component) => (
                        <li key={component.id}>
                          <button
                            type="button"
                            className="text-left w-full rounded-md px-2 py-1.5 hover:bg-muted/80 text-foreground"
                            onClick={() => {
                              onSelectNode(component.id);
                              onClose();
                            }}
                          >
                            <span className="font-medium">{componentLabel(component)}</span>
                            <span className="text-muted-foreground text-xs ml-2">{component.type}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("impactAnalysis.brokenConnections")}
              </h4>
              {impact.brokenConnections.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("impactAnalysis.noDependents")}</p>
              ) : (
                <ul className="space-y-1">
                  {impact.brokenConnections.map((connection) => (
                    <li key={connection.id}>
                      <button
                        type="button"
                        className="text-left w-full rounded-md px-2 py-1.5 hover:bg-muted/80 text-foreground"
                        onClick={() => {
                          onSelectConnection(connection.id);
                          onClose();
                        }}
                      >
                        {connectionLabel(connection)}
                        <span className="text-muted-foreground text-xs block">
                          {connection.sourceId} → {connection.targetId}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        )}
        <Button type="button" variant="secondary" className="mt-auto" onClick={onClose}>
          {t("common.close")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
