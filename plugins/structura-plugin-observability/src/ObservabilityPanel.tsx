import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Separator,
  Stack,
  Switch,
  Tabs,
  Tooltip,
} from "@structura/ui";
import type { PluginPanelProps, StructuraPluginApi } from "./types/plugin.types";
import { OBSERVABILITY_PACK, PLUGIN_ID } from "./pack";
import { localeOf, t } from "./i18n";
import {
  ONCALL_PATTERN,
  readSettings,
  RETENTION_OPTIONS,
  writeSettings,
  type ObservabilitySettings,
} from "./settings";

const serviceName = (id: string | null) =>
  OBSERVABILITY_PACK.services?.find((service) => service.id === id)?.name ?? null;

/**
 * Inspector panel for this plugin's elements, drawn only with the host UI kit
 * (`@structura/ui`): it matches the inspector around it, light and dark, with no CSS of its own.
 */
export function createObservabilityPanel(api: StructuraPluginApi) {
  return function ObservabilityPanel({ context }: PluginPanelProps) {
    const locale = localeOf(context.locale);
    const element = context.selection.length === 1 ? context.selection[0] : null;
    const ours = !!element && element.type.startsWith(`${PLUGIN_ID}/`);
    const saved = useMemo(() => readSettings(element?.tags ?? []), [element?.tags]);
    const [draft, setDraft] = useState<ObservabilitySettings>(saved);

    // A different element, or tags changed elsewhere (undo): start from what is stored.
    useEffect(() => setDraft(saved), [saved]);

    if (!element || !ours) {
      return <p className="text-xs text-muted-foreground">{t("notOurs", locale)}</p>;
    }

    const oncallInvalid = !ONCALL_PATTERN.test(draft.oncall);
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const service = serviceName(element.cloudServiceId);

    const apply = () => {
      context.updateComponent(element.id, { tags: writeSettings(element.tags, draft) });
      api.overlay.showToast({ type: "success", title: t("applied", locale) });
    };

    const settings = (
      <Stack gap={4}>
        <Field label={t("retention", locale)} hint={t("retentionHint", locale)}>
          <Select
            value={draft.retentionDays}
            onValueChange={(retentionDays) => setDraft({ ...draft, retentionDays })}
            options={RETENTION_OPTIONS.map((n) => ({ value: n, label: t("days", locale, { n }) }))}
          />
        </Field>

        <Stack direction="row" justify="between" align="center">
          <span className="text-sm text-foreground">{t("alerting", locale)}</span>
          <Switch
            aria-label={t("alerting", locale)}
            checked={draft.alerting}
            onCheckedChange={(alerting) => setDraft({ ...draft, alerting })}
          />
        </Stack>

        <Field
          label={t("owner", locale)}
          error={oncallInvalid ? t("ownerError", locale) : undefined}
        >
          <Input
            value={draft.oncall}
            placeholder={t("ownerPlaceholder", locale)}
            onChange={(event) => setDraft({ ...draft, oncall: event.target.value })}
          />
        </Field>
      </Stack>
    );

    const tags = element.tags.length ? (
      <Stack direction="row" gap={1} wrap>
        {element.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </Stack>
    ) : (
      <p className="text-xs text-muted-foreground">{t("noTags", locale)}</p>
    );

    return (
      <Card
        title={t("title", locale)}
        description={
          service ? (
            <Stack direction="row" gap={2} align="center">
              <span>{t("service", locale)}</span>
              <Badge variant="secondary">{service}</Badge>
            </Stack>
          ) : undefined
        }
        footer={
          <>
            <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDraft(saved)}>
              {t("reset", locale)}
            </Button>
            <Tooltip content={t("retentionHint", locale)}>
              <Button
                size="sm"
                disabled={!dirty || oncallInvalid || !context.isEditMode}
                onClick={apply}
              >
                {t("apply", locale)}
              </Button>
            </Tooltip>
          </>
        }
      >
        <Tabs
          tabs={[
            { value: "settings", label: t("tabSettings", locale), content: settings },
            { value: "tags", label: t("tabTags", locale), content: tags },
          ]}
        />
        <Separator style={{ marginTop: 12 }} />
      </Card>
    );
  };
}
