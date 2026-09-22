import { Copy, FolderInput, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import type { DiagramItemActions } from "@/pages/dashboard/dashboard.types";
import { CardAction } from "./CardAction";

interface DiagramItemActionButtonsProps {
  diagram: Diagram;
  actions: DiagramItemActions;
}

/** Rename / duplicate / move / delete buttons shared by the grid card and the list row. */
export function DiagramItemActionButtons({ diagram, actions }: DiagramItemActionButtonsProps) {
  const { t } = useTranslation();

  return (
    <>
      <CardAction
        icon={<Pencil size={13} />}
        title={t("dashboard.card.rename")}
        onClick={() => actions.onRename(diagram)}
      />
      <CardAction
        icon={<Copy size={13} />}
        title={t("dashboard.card.duplicate")}
        onClick={() => actions.onDuplicate(diagram)}
      />
      <CardAction
        icon={<FolderInput size={13} />}
        title={t("dashboard.card.move")}
        onClick={() => actions.onMove(diagram)}
      />
      <CardAction
        icon={<Trash2 size={13} />}
        title={t("dashboard.card.delete")}
        onClick={() => actions.onDelete(diagram)}
        variant="danger"
      />
    </>
  );
}
