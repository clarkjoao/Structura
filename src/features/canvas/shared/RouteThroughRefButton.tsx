import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConnection, useDiagramActions, useResolvedComponents } from "@/features/diagram";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { canBeReferenced } from "@/features/elements/referencing";

/**
 * On a selected edge: end it on a new reference to its target, beside its
 * source — for the long edge that crosses the diagram to reach something many
 * things use. Absent when the edge already ends on a reference.
 */
export function RouteThroughRefButton({ connectionId }: { connectionId: string }) {
  const { t } = useTranslation();
  // The stored edge, not the drawn one: a compact container redraws an edge
  // to itself, and the reference must stand for what the edge really reaches.
  const connection = useConnection(connectionId);
  const components = useResolvedComponents();
  const { routeConnectionThroughRef } = useDiagramActions();
  const target = connection ? components[connection.targetId] : undefined;
  if (!target || isSharedRefComponent(target) || !canBeReferenced(target)) return null;
  return (
    <button
      type="button"
      title={t("shared.routeThroughRef")}
      aria-label={t("shared.routeThroughRef")}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
                 transition-colors hover:bg-surface-hover hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        routeConnectionThroughRef(connectionId);
      }}
    >
      <Link2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
