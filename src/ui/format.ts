/** Convert ISO-8601 timestamp (YYYY-MM-DDTHH:MM:SS) to epoch seconds */
export function toEpoch(ts: string): number {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

/** Format seconds as human-readable duration: 3s, 5m, 2h, 1d */
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/** Format how long ago a timestamp was (e.g., "2h ago" returns "2h") */
export function ago(ts: string): string {
  const tsEpoch = toEpoch(ts);
  const now = Math.floor(Date.now() / 1000);
  return formatDuration(now - tsEpoch);
}

/** Check if a timestamp is older than threshold seconds */
export function isStale(ts: string, thresholdSeconds: number): boolean {
  const tsEpoch = toEpoch(ts);
  const now = Math.floor(Date.now() / 1000);
  return (now - tsEpoch) > thresholdSeconds;
}

/** Format current local time as ISO-8601 (YYYY-MM-DDTHH:MM:SS) */
export function tsLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format current date for board header: "Sun Mar 15, 14:32" */
export function dateHeader(): string {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${pad(d.getDate())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Truncate a string to maxLen, appending "..." if truncated */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}
