/**
 * /api/list-drives
 *
 * Diagnostic endpoint — lists every drive the signed-in user can access,
 * including SharePoint document libraries. Hit this once to find the drive
 * ID for the TEN SharePoint library, then store it as ONEDRIVE_DRIVE_ID
 * in Vercel env vars.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

async function getToken(): Promise<string | null> {
  // Try stored refresh token first
  const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (refreshToken && AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
    const res = await fetch(
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: AZURE_CLIENT_ID,
          client_secret: AZURE_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://graph.microsoft.com/Files.Read.All offline_access Sites.Read.All",
        }),
        cache: "no-store",
      }
    );
    const data = await res.json();
    if (data.access_token) return data.access_token;
  }

  // Fall back to session
  const session = await auth();
  return session?.accessToken ?? null;
}

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { error: `${res.status} ${res.statusText}`, url };
  return res.json();
}

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated — sign in first." }, { status: 401 });
  }

  // 1. All drives the user has direct access to (personal + SharePoint libs)
  const drives = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drives");

  // 2. Items shared with me (may include TEN if it was shared)
  const sharedWithMe = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$select=name,id,remoteItem&$top=50"
  );

  // 3. Followed SharePoint sites
  const followedSites = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/followedSites?$select=id,name,webUrl"
  );

  // 4. For every drive found, try listing its root children so we can see if TEN is there
  const driveRoots: Record<string, unknown> = {};
  if (Array.isArray(drives?.value)) {
    for (const drive of drives.value as Array<{ id: string; name: string; driveType: string }>) {
      const root = await graphGet(
        token,
        `https://graph.microsoft.com/v1.0/drives/${drive.id}/root/children?$select=name,id,folder,file&$top=100`
      );
      driveRoots[`${drive.name} (${drive.driveType}) [${drive.id}]`] =
        (root?.value ?? []).map((i: { name: string; folder?: unknown; file?: unknown }) =>
          `${i.name}(${i.folder ? "folder" : "file"})`
        );
    }
  }

  return NextResponse.json(
    {
      hint: "Find the drive whose root contains 'Events' or 'TEN'. Copy its ID and set it as ONEDRIVE_DRIVE_ID in Vercel.",
      drives: drives?.value?.map((d: { id: string; name: string; driveType: string; webUrl?: string }) => ({
        id: d.id,
        name: d.name,
        driveType: d.driveType,
        webUrl: d.webUrl,
      })),
      driveRoots,
      sharedWithMe: sharedWithMe?.value?.map((i: { name: string; id: string; remoteItem?: { parentReference?: { driveId?: string } } }) => ({
        name: i.name,
        id: i.id,
        remoteDriveId: i.remoteItem?.parentReference?.driveId,
      })),
      followedSites: followedSites?.value,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
