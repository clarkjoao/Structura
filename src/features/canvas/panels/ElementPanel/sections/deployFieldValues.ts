export const DEPLOY_LABEL_CLASS =
  "text-[11px] text-muted-foreground uppercase tracking-wider font-semibold";

/** Free text; empty clears the field instead of storing "". */
export const text = (value: string) => (value === "" ? undefined : value);

/** A positive number; empty or invalid clears it. */
export const positive = (value: string) => {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) || n <= 0 ? undefined : n;
};

/** A whole number, zero allowed; empty or invalid clears it. */
export const whole = (value: string) => {
  const n = Number(value);
  return value.trim() === "" || !Number.isInteger(n) || n < 0 ? undefined : n;
};

/** "1a, 1b" → ["1a", "1b"]; nothing left clears it. */
export const list = (value: string) => {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};
