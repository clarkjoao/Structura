/**
 * Formats an ISO timestamp string as "hh:mm dd/mm/yy".
 * Returns the raw string if parsing fails.
 */
export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const dd = pad(d.getDate());
    const mo = pad(d.getMonth() + 1);
    const yy = String(d.getFullYear()).slice(-2);
    return `${hh}:${mm} ${dd}/${mo}/${yy}`;
  } catch {
    return iso;
  }
}
