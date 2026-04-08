/**
 * /api/reports-debug
 * Full diagnostic — checks every possible way to reach the TEN folder
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function getRefreshToken(): Promise<string | null> {
  const rt = process.env.ONEDRIVE_REFRESH_TOKEN;
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!rt || !AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) return null;
  const res = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: rt,
        scope: "https://graph.microsoft.com/Files.Read offline_access",
      }),
      cache: "no-store",
    }
  );
  const data = await res.json();
  return data.access_token ?? null;
}

export async function GET() {
  const out: Record<string, unknown> = {};

  // ── 1. Env check ────────────────────────────────────────────────────────────
  out.env = {
    hasRefreshToken: !!process.env.ONEDRIVE_REFRESH_TOKEN,
    hasClientId:     !!process.env.AZURE_CLIENT_ID,
    hasClientSecret: !!process.env.AZURE_CLIENT_SECRET,
    hasTenantId:     !!process.env.AZURE_TENANT_ID,
  };

  // ── 2. Get a token (refresh token preferred, fall back to session) ──────────
  let token: string | null = null;
  let tokenSource = "none";

  const refreshToken = await getRefreshToken();
  if (refreshToken) { token = refreshToken; tokenSource = "refresh_token"; }

  if (!token) {
    const session = await auth();
    if (session?.accessToken) { token = session.accessToken; tokenSource = "session"; }
  }

  out.tokenSource = tokenSource;
  if (!token) {
    out.error = "No token available — sign in or set ONEDRIVE_REFRESH_TOKEN in Vercel";
    return NextResponse.json(out);
  }

  // ── 3. Who am I? ────────────────────────────────────────────────────────────
  const me = await graphGet(token, "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName");
  out.me = me.body;

  // ── 4. List ALL drives this user can access ─────────────────────────────────
  const drives = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drives?$select=id,name,driveType,webUrl");
  out.allDrives = (drives.body?.value ?? []).map((d: {id:string;name:string;driveType:string;webUrl:string}) => ({
    id: d.id, name: d.name, driveType: d.driveType, webUrl: d.webUrl,
  }));

  // ── 5. Root children of main drive ─────────────────────────────────────────
  const rootChildren = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=name,id,folder,remoteItem&$top=200"
  );
  const rootItems = rootChildren.body?.value ?? [];
  out.driveRootFolders = rootItems
    .filter((i: {folder?: unknown}) => i.folder)
    .map((i: {name:string; remoteItem?: {id:string; parentReference?: {driveId:string}}}) => ({
      name: i.name,
      isShortcut: !!i.remoteItem,
      remoteItemId: i.remoteItem?.id,
      remoteDriveId: i.remoteItem?.parentReference?.driveId,
    }));

  // ── 6. Specifically look for TEN ───────────────────────────────────────────
  const tenItem = rootItems.find((i: {name:string}) =>
    i.name.toLowerCase() === "ten"
  );
  out.tenInRoot = tenItem ? {
    found: true,
    name: tenItem.name,
    isShortcut: !!tenItem.remoteItem,
    remoteItemId: tenItem.remoteItem?.id,
    remoteDriveId: tenItem.remoteItem?.parentReference?.driveId,
  } : { found: false };

  // ── 7. Try sharedWithMe ────────────────────────────────────────────────────
  const shared = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$select=name,id,folder,remoteItem&$top=100"
  );
  const sharedItems = shared.body?.value ?? [];
  out.sharedWithMe = sharedItems
    .filter((i: {folder?: unknown}) => i.folder)
    .map((i: {name:string; remoteItem?: {id:string; parentReference?: {driveId:string}}}) => ({
      name: i.name,
      isShortcut: !!i.remoteItem,
      remoteItemId: i.remoteItem?.id,
      remoteDriveId: i.remoteItem?.parentReference?.driveId,
    }));

  // ── 8. Search the entire drive for "TEN" ──────────────────────────────────
  const search = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/root/search(q='TEN')?$select=name,id,folder,parentReference&$top=20"
  );
  out.searchForTEN = (search.body?.value ?? [])
    .filter((i: {folder?: unknown}) => i.folder)
    .map((i: {name:string; id:string; parentReference?: {path:string; driveId:string}}) => ({
      name: i.name,
      id: i.id,
      parentPath: i.parentReference?.path,
      parentDriveId: i.parentReference?.driveId,
    }));

  // ── 9. Search for .pptx files directly ────────────────────────────────────
  const pptxSearch = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pptx')?$select=name,id,parentReference&$top=10"
  );
  out.pptxSearchSample = {
    status: pptxSearch.status,
    count: pptxSearch.body?.value?.length ?? 0,
    sample: (pptxSearch.body?.value ?? []).slice(0, 3).map((i: {name:string; parentReference?: {path:string}}) => ({
      name: i.name,
      path: i.parentReference?.path,
    })),
  };

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
