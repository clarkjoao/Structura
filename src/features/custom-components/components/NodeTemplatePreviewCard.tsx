import type { ReactNode } from "react";
import { Box, FileText } from "lucide-react";
import { PICKER_CARD_CLASS } from "@/features/canvas/toolbar/element-picker/constants";
import type { CustomComponentTemplate } from "../customComponent.types";
import { resolveTemplateAccentColor } from "../utils/resolveTemplateAccentColor";
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
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function NodeTemplatePreviewCard({ template, onClick }: NodeTemplatePreviewCardProps) {
  const customIconIdFromData = readNonEmptyString(template.data.customIconId) ?? "";
  const customIconDefinition = useIconById(customIconIdFromData);

  const resolvedTemplateType =
    readNonEmptyString(template.data.type) ?? template.baseType;

  const resolvedPanelKind =
    typeof template.data.panelKind === "string" && isPanelKind(template.data.panelKind)
      ? template.data.panelKind
      : undefined;

  const accentColorClassName = resolveTemplateAccentColor(template.baseType);

  const iconClassName = "h-5 w-5 shrink-0 text-muted-foreground";

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
        PICKER_CARD_CLASS,
        "items-start justify-start text-left",
        accentColorClassName,
      )}
    >
      <div className="w-full flex items-center gap-2">
        {iconNode}
        <span className="text-xs font-medium truncate">{template.name}</span>
      </div>

      {template.description ? (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{template.description}</p>
      ) : null}

      <div className="mt-auto w-full">
        <span className="inline-flex text-[10px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
          {template.baseType}
        </span>
      </div>
    </button>
  );
}

