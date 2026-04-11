function randomBytesBase64url(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateToken(): string {
  return randomBytesBase64url(32);
}

export function generateId(): string {
  return randomBytesBase64url(12);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const normalized = slugify(base) || "item";
  if (!(await exists(normalized))) return normalized;

  for (let i = 2; i <= 10; i++) {
    const candidate = `${normalized}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  const suffix = randomBytesBase64url(4).toLowerCase().slice(0, 6);
  return `${normalized}-${suffix}`;
}

const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
