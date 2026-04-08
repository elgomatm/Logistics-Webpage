import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const results: Record<string, unknown> = {};

  // 1. Check session
  results.session = {
    hasSession: !!session,
    hasAccessToken: !!session?.accessToken,
    user: session?.user?.email ?? null,
  };

  // 2. Try Graph with session token — list drive root children
  if (session?.accessToken) {
    try {
      // List root children to find TEN (works for regular folders AND shortcuts/remoteItems)
      const rootRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=name,id,folder,remoteItem&$top=100",
        { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
      );
      const rootBody = await rootRes.json();
      const rootItems = rootBody?.value ?? [];

      results.driveRoot = {
        status: rootRes.status,
        folders: rootItems
          .filter((i: {folder?: unknown}) => i.folder)
          .map((i: {name: string; remoteItem?: unknown}) => ({
            name: i.name,
            isShortcut: !!i.remoteItem,
          })),
      };

      // Find TEN specifically
      const tenItem = rootItems.find(
        (i: {name: string}) => i.name.toLowerCase() === "ten"
      );

      if (tenItem) {
        results.tenFound = {
          name: tenItem.name,
          isShortcut: !!tenItem.remoteItem,
          remoteInfo: tenItem.remoteItem
            ? {
                id: tenItem.remoteItem.id,
                driveId: tenItem.remoteItem.parentReference?.driveId ?? tenItem.remoteItem.driveId,
              }
            : null,
          localId: tenItem.id,
        };

        // Try to list Events inside TEN
        let eventsUrl: string;
        if (tenItem.remoteItem) {
          const driveId =
            tenItem.remoteItem.parentReference?.driveId ?? tenItem.remoteItem.driveId;
          const itemId = tenItem.remoteItem.id;
          eventsUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children?$select=name,folder&$top=50`;
        } else {
          eventsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${tenItem.id}/children?$select=name,folder&$top=50`;
        }

        const tenChildren = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: "no-store",
        });
        const tenBody = await tenChildren.json();

        results.tenChildren = {
          status: tenChildren.status,
          folders: (tenBody?.value ?? [])
            .filter((i: {folder?: unknown}) => i.folder)
            .map((i: {name: string}) => i.name),
        };
      } else {
        results.tenFound = null;

        // Try a search
        const searchRes = await fetch(
          "https://graph.microsoft.com/v1.0/me/drive/root/search(q='TEN')?$select=name,id,folder,remoteItem&$top=20",
          { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
        );
        const searchBody = await searchRes.json();
        results.tenSearch = {
          status: searchRes.status,
          results: (searchBody?.value ?? []).map((i: {name: string; folder?: unknown; remoteItem?: unknown}) => ({
            name: i.name,
            isFolder: !!i.folder,
            isShortcut: !!i.remoteItem,
          })),
        };
      }
    } catch (e) {
      results.graphError = String(e);
    }
  }

  // 3. Check env vars (masked)
  results.envVars = {
    AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
    ONEDRIVE_USER_EMAIL: process.env.ONEDRIVE_USER_EMAIL ?? "NOT SET",
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
  };

  // 4. Try app-creds token
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
    try {
      const tr = await fetch(
        `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: AZURE_CLIENT_ID,
            client_secret: AZURE_CLIENT_SECRET,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }),
          cache: "no-store",
        }
      );
      const td = await tr.json();
      results.appToken = { obtained: !!td.access_token, error: td.error ?? null };
    } catch (e) {
      results.appToken = { error: String(e) };
    }
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
