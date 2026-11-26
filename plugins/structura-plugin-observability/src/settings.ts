/**
 * The plugin's settings live on the element as tags (the whitelisted field plugins may patch),
 * so they travel with the diagram and one undo reverts an Apply:
 *   `retention:30d`, `alerting`, `oncall:payments`.
 */
export interface ObservabilitySettings {
  retentionDays: string;
  alerting: boolean;
  oncall: string;
}

export const RETENTION_OPTIONS = ["7", "30", "90", "365"] as const;
const DEFAULT_RETENTION = "30";
export const ONCALL_PATTERN = /^[a-z0-9-]*$/;

const OWN_TAG = /^(retention:\d+d|alerting|oncall:.+)$/;

export function readSettings(tags: readonly string[]): ObservabilitySettings {
  const retention = tags.find((tag) => tag.startsWith("retention:"));
  const oncall = tags.find((tag) => tag.startsWith("oncall:"));
  return {
    retentionDays: retention ? retention.slice("retention:".length, -1) : DEFAULT_RETENTION,
    alerting: tags.includes("alerting"),
    oncall: oncall ? oncall.slice("oncall:".length) : "",
  };
}

/** The element's tags with this plugin's replaced by `settings`; other tags are kept. */
export function writeSettings(tags: readonly string[], settings: ObservabilitySettings): string[] {
  const kept = tags.filter((tag) => !OWN_TAG.test(tag));
  return [
    ...kept,
    `retention:${settings.retentionDays}d`,
    ...(settings.alerting ? ["alerting"] : []),
    ...(settings.oncall ? [`oncall:${settings.oncall}`] : []),
  ];
}
