import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission } from "./permissions";

export const getSession = cache(async () => {
  return auth();
});

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(
  roles: Array<"admin" | "logistics" | "media" | "viewer">,
) {
  const session = await requireSession();
  if (!roles.includes(session.user.role as (typeof roles)[number])) {
    redirect("/");
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can({ role: session.user.role as string }, permission)) {
    redirect("/");
  }
  return session;
}
