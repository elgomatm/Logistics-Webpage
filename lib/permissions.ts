export type Role = "admin" | "logistics" | "media" | "viewer";

export const permissions = {
  "users.invite": ["admin"] as Role[],
  "users.manage": ["admin"] as Role[],
  "users.view": ["admin"] as Role[],
  "events.create": ["admin", "logistics"] as Role[],
  "events.edit": ["admin", "logistics"] as Role[],
  "events.view": ["admin", "logistics", "media", "viewer"] as Role[],
  "tasks.create": ["admin", "logistics"] as Role[],
  "tasks.assign": ["admin", "logistics"] as Role[],
  "tasks.work": ["admin", "logistics", "media"] as Role[],
  "tasks.view": ["admin", "logistics", "media", "viewer"] as Role[],
  "reports.create": ["admin", "logistics"] as Role[],
  "reports.edit": ["admin", "logistics"] as Role[],
  "reports.view": ["admin", "logistics", "media", "viewer"] as Role[],
  "guides.create": ["admin", "logistics"] as Role[],
  "guides.edit": ["admin", "logistics"] as Role[],
  "guides.view": ["admin", "logistics", "media", "viewer"] as Role[],
} as const;

export type Permission = keyof typeof permissions;

export function can(
  user: { role: string } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return (permissions[permission] as readonly string[]).includes(user.role);
}
