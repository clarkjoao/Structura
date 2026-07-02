export function formatTimestamp(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return String(timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const dd = pad(d.getDate());
    const mo = pad(d.getMonth() + 1);
    const yy = String(d.getFullYear()).slice(-2);
    return `${hh}:${mm} ${dd}/${mo}/${yy}`;
  } catch {
    return String(timestamp);
  }
}
