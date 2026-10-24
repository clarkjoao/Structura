import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { LegendModel } from "@/features/diagram/utils/legend";
import { isLegendEmpty } from "@/features/diagram/utils/legend";

const SWATCH_NEUTRAL = "#64748b";

/** What the legend says, as a card: shared by the canvas node and the panel's preview. */
export function LegendContent({ legend }: { legend: LegendModel }) {
  const { t } = useTranslation();
  if (isLegendEmpty(legend)) {
    return <p className="text-xs text-muted-foreground">{t("legend.empty")}</p>;
  }
  return (
    <div className="space-y-2.5 text-xs text-foreground">
      {legend.boundaryTypes.length > 0 && (
        <section aria-label={t("legend.boundaryTypes")}>
          <h4 className="mb-1 font-semibold text-muted-foreground">{t("legend.boundaryTypes")}</h4>
          <ul className="space-y-1">
            {legend.boundaryTypes.map(({ type, borderStyle }) => (
              <li key={type} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-4 w-7 shrink-0 rounded-sm"
                  style={{ border: `2px ${borderStyle} ${SWATCH_NEUTRAL}` }}
                />
                {t(`boundary.types.${type}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {legend.domains.length > 0 && (
        <section aria-label={t("legend.domains")}>
          <h4 className="mb-1 font-semibold text-muted-foreground">{t("legend.domains")}</h4>
          <ul className="space-y-1">
            {legend.domains.map(({ name, color }) => (
              <li key={name} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-4 w-7 shrink-0 rounded-sm"
                  style={{ backgroundColor: color, opacity: 0.85 }}
                />
                {name}
              </li>
            ))}
          </ul>
        </section>
      )}
      {legend.interactions.length > 0 && (
        <section aria-label={t("legend.interactions")}>
          <h4 className="mb-1 font-semibold text-muted-foreground">{t("legend.interactions")}</h4>
          <ul className="space-y-1">
            {legend.interactions.map((interaction) => (
              <li key={interaction} className="flex items-center gap-2">
                <svg aria-hidden width="28" height="8" className="shrink-0">
                  <line
                    x1="1"
                    y1="4"
                    x2="27"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={interaction === "async" ? "5 3" : undefined}
                  />
                </svg>
                {t(`connectionPanel.interactions.${interaction}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The generated legend, drawn on the canvas by both the editor and the viewer. */
function LegendNodeImpl({ data }: { data: { legend: LegendModel } }) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none min-w-44 rounded-lg border border-border bg-card/95 p-3 shadow-sm"
      data-testid="diagram-legend"
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("legend.title")}
      </h3>
      <LegendContent legend={data.legend} />
    </div>
  );
}

export const LegendNode = memo(LegendNodeImpl);
