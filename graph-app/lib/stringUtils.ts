export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}
