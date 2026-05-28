export function parseKeywords(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}
