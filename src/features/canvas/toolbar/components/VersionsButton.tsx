import { forwardRef } from "react";
import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { cn } from "@/lib/utils";

export interface VersionsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  diagram: Pick<Diagram, "versions" | "activeVersionId">;
  locked: boolean;
  /** The versions panel is open: the button shows it as pressed. */
  open?: boolean;
}

/**
 * Opens the versions panel; shows the active version, with its color, when one
 * is. Forwards its ref and props, so a popover can use it as its trigger.
 */
export const VersionsButton = forwardRef<HTMLButtonElement, VersionsButtonProps>(
  function VersionsButton({ diagram, locked, open = false, className, ...props }, ref) {
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
        ref={ref}
        type="button"
        disabled={locked}
        title={title}
        aria-label={activeVersion ? `${title}: ${activeVersion.name}` : title}
        {...props}
        className={cn(
          className,
          "border",
          open ? "border-primary bg-primary/10 text-foreground" : "border-transparent",
          locked && "pointer-events-none opacity-50",
        )}
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
  },
);
