import type { ReactNode } from "react";
import { Box, FileText, X } from "lucide-react";
import type { CustomComponentTemplate } from "../types";
import { resolveTemplateAccentColor } from "../utils/resolve-template-accent-color";
import { cn } from "@/lib/utils";
import { useIconById, isPanelKind, isC4Type, isPanelType, isNoteType } from "@/features/diagram";
import { TypeConfig } from "@/features/canvas/nodes/CustomNode/TypeConfig";
import { AWS_SERVICE_MAP, isAwsType } from "@/lib/catalogs/aws";
import AwsIcon from "@/features/canvas/nodes/AwsIcon";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";

type NodeTemplate = CustomComponentTemplate;

export interface NodeTemplatePreviewCardProps {
  template: NodeTemplate;
  onClick: () => void;
  onDelete?: () => void;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function NodeTemplatePreviewCard({
  template,
  onClick,
  onDelete,
}: NodeTemplatePreviewCardProps) {
  const customIconIdFromData = readNonEmptyString(template.data.customIconId) ?? "";
  const customIconDefinition = useIconById(customIconIdFromData);

  const resolvedTemplateType = readNonEmptyString(template.data.type) ?? template.baseType;

  const resolvedPanelKind =
    typeof template.data.panelKind === "string" && isPanelKind(template.data.panelKind)
      ? template.data.panelKind
      : undefined;

  const accentColorClassName = resolveTemplateAccentColor(template.baseType);

  const iconColorClass = isC4Type(resolvedTemplateType)
    ? (TypeConfig[resolvedTemplateType]?.textColor ?? "text-muted-foreground")
    : "text-muted-foreground";
  const iconClassName = cn("h-5 w-5 shrink-0", iconColorClass);

  let iconNode: ReactNode = <Box className={iconClassName} />;

  if (customIconDefinition) {
    iconNode = (
      <CustomIconRenderer icon={customIconDefinition} size={20} className={iconClassName} />
    );
  } else if (isAwsType(resolvedTemplateType)) {
    const awsServiceId = readNonEmptyString(template.data.awsService);
    const awsService = awsServiceId ? AWS_SERVICE_MAP.get(awsServiceId) : undefined;
    if (awsService?.iconName) {
      iconNode = <AwsIcon iconName={awsService.iconName} size={20} className={iconClassName} />;
    }
  } else if (isC4Type(resolvedTemplateType)) {
    const c4Cfg = TypeConfig[resolvedTemplateType];
    if (c4Cfg) {
      const Icon = c4Cfg.icon;
      iconNode = <Icon className={iconClassName} />;
    }
  } else if (isPanelType(resolvedTemplateType)) {
    const panelKindDef = getPanelKindDef(resolvedPanelKind);
    const awsIconNameFromTemplate = readNonEmptyString(template.data.awsIconName);
    const awsIconName = awsIconNameFromTemplate ?? panelKindDef.awsIconName;

    if (awsIconName) {
      iconNode = <AwsIcon iconName={awsIconName} size={20} className={iconClassName} />;
    } else {
      const PanelIcon = panelKindDef.icon;
      iconNode = <PanelIcon className={iconClassName} />;
    }
  } else if (isNoteType(resolvedTemplateType)) {
    iconNode = <FileText className={iconClassName} strokeWidth={1.5} />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1 rounded-lg border border-border bg-card text-left",
        "border-l-[3px] px-2.5 py-2 transition-all duration-150",
        "hover:shadow-sm hover:brightness-105 active:scale-[0.98]",
        accentColorClassName,
      )}
    >
      {onDelete ? (
        <button
          type="button"
          className="absolute right-2 top-2 rounded-full bg-destructive/10 p-0.5 text-destructive opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}

      <div className="flex items-center gap-2 pr-4">
        {iconNode}
        <span className="truncate text-sm font-bold leading-tight text-foreground">
          {template.name}
        </span>
      </div>

      {template.description ? (
        <p className="line-clamp-1 text-xs leading-snug text-muted-foreground">
          {template.description}
        </p>
      ) : null}

      <div className="mt-auto pt-1">
        <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {template.baseType}
        </span>
      </div>
    </button>
  );
}
