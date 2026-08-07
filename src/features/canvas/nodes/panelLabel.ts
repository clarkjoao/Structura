/**
 * Panel headers prefix the kind label ("VPC - Production VPC"). When the name
 * already says what the panel is, the prefix only eats the space the name needs
 * — generated AWS diagrams hit this on nearly every boundary ("VPC - VPC",
 * "Private Subnet - Private Subnet"). Show the prefix only when it adds
 * something the name does not already carry.
 */
function panelKindAddsInformation(kindLabel: string, name: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedLabel = normalize(kindLabel);
  if (!normalizedLabel) return false;
  if (normalize(name).includes(normalizedLabel)) return false;

  // Names routinely use the acronym instead of the full label — "AZ us-east-1a"
  // under the "Availability Zone" kind says the same thing twice.
  const words = kindLabel.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const acronym = words
      .map((word) => word[0])
      .join("")
      .toLowerCase();
    if (new RegExp(`\\b${acronym}\\b`, "i").test(name)) return false;
  }
  return true;
}

export function buildPanelHeaderLabel(
  panelKind: string | undefined,
  kindLabel: string,
  name: string,
): string {
  if (panelKind === "default" || !panelKindAddsInformation(kindLabel, name)) {
    return name;
  }
  return `${kindLabel} - ${name}`;
}

/** Collapsed panels show the kind next to the child count, under the name. */
export function buildPanelSubLabel(
  panelKind: string | undefined,
  kindLabel: string,
  name: string,
  childCountLabel: string,
): string {
  if (panelKind === "default" || !panelKindAddsInformation(kindLabel, name)) {
    return childCountLabel;
  }
  return `${kindLabel} - ${childCountLabel}`;
}
