import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { cn } from "@/lib/utils";

export interface VersionsButtonProps {
  diagram: Pick<Diagram, "versions" | "activeVersionId">;
  locked: boolean;
  onOpenVersions: () => void;
  /** Classes of the host toolbar's buttons. */
  className?: string;
}

/** Opens the versions drawer; shows the active version, with its color, when one is. */
export function VersionsButton({
  diagram,
  locked,
  onOpenVersions,
  className,
}: VersionsButtonProps) {
  const { t } = useTranslation();
  const versions = diagram.versions ?? {};
  const activeVersion =
    diagram.activeVersionId && versions[diagram.activeVersionId]
      ? versions[diagram.activeVersionId]
      : null;
  const title = locked
    ? t("diagramNav.unavailableWhileRecordingOrPlayback")
    : t("versions.viewVersionsTitle");

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onOpenVersions}
      title={title}
      aria-label={activeVersion ? `${title}: ${activeVersion.name}` : title}
      className={cn(className, locked && "pointer-events-none opacity-50")}
    >
      {activeVersion ? (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: activeVersion.color }}
        />
      ) : (
        <GitBranch aria-hidden className="h-4 w-4 shrink-0" />
      )}
      {/* Icon only, until a version is active: then its name is worth the room. */}
      {activeVersion && <span className="max-w-[8rem] truncate">{activeVersion.name}</span>}
    </button>
  );
}
