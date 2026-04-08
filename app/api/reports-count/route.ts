/**
 * /api/reports-count
 *
 * Reads the TEN Events/2026 folder and counts .pptx/.pdf report files
 * per event by trying three strategies, in order:
 *
 *  1. Delegated Microsoft Graph API (uses the signed-in user's session token)
 *     This is the primary strategy for Vercel deployments — no extra env vars needed
 *     beyond the OAuth setup already required for login.
 *
 *  2. App-credential Microsoft Graph API (app-only, requires ONEDRIVE_USER_EMAIL)
 *     Fallback if no session token is available (e.g., called from a background job).
 *     Requires: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, ONEDRIVE_USER_EMAIL
 *     App Registration needs: Microsoft Graph > Files.Read.All (Application permission)
 *
 *  3. Local filesystem fallback (works when running `npm run dev` on your Mac)
 *     No setup needed — reads directly from the synced OneDrive path.
 */

import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";

// ── Constants ──────────────────────────────────────────────────
const LOCAL_BASE =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events/2026";

const ONEDRIVE_FOLDER_PATH = "TEN/Events/2026";

const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReport(name: string) {
  const lc = name.toLowerCase();
  return REPORT_EXTENSIONS.some((ext) => lc.endsWith(ext));
}

// ── Graph API helpers ──────────────────────────────────────────

async function graphGet(token: string, path: string) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Strategy 1: Delegated auth — uses the signed-in user's own access token.
 * Calls /me/drive/ so no ONEDRIVE_USER_EMAIL needed.
 */
async function countViaDelegatedGraph(accessToken: string) {
  // List 2026 event folders under the user's own drive
  const eventList = await graphGet(
    accessToken,
    `/me/drive/root:/${ONEDRIVE_FOLDER_PATH}:/children?$select=name,folder`
  );

  if (!eventList?.value) return null;

  const eventFolders: string[] = eventList.value
    .filter((item: { folder?: unknown }) => item.folder)
    .map((item: { name: string }) => item.name);

  const events: { name: string; count: number; files: string[] }[] = [];
  let total = 0;

  for (const eventName of eventFolders) {
    const reportsPath = `${ONEDRIVE_FOLDER_PATH}/${eventName}/Documents/Reports`;
    const files = await graphGet(
      accessToken,
      `/me/drive/root:/${reportsPath}:/children?$select=name,file`
    );

    const reportFiles: string[] = files?.value
      ? files.value
          .filter((f: { file?: unknown; name: string }) => f.file && isReport(f.name))
          .map((f: { name: string }) => f.name)
      : [];

    total += reportFiles.length;
    events.push({ name: eventName, count: reportFiles.length, files: reportFiles });
  }

  return { total, events, synced: true, source: "graph-delegated" };
}

/**
 * Strategy 2: App credentials — client_credentials flow.
 * Requires ONEDRIVE_USER_EMAIL env var.
 */
async function getAppGraphToken(): Promise<string | null> {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) return null;

  try {
    const res = await fetch(
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
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function countViaAppGraph() {
  const token = await getAppGraphToken();
  if (!token) return null;

  const userId = process.env.ONEDRIVE_USER_EMAIL;
  if (!userId) return null;

  const eventList = await graphGet(
    token,
    `/users/${encodeURIComponent(userId)}/drive/root:/${ONEDRIVE_FOLDER_PATH}:/children?$select=name,folder`
  );

  if (!eventList?.value) return null;

  const eventFolders: string[] = eventList.value
    .filter((item: { folder?: unknown }) => item.folder)
    .map((item: { name: string }) => item.name);

  const events: { name: string; count: number; files: string[] }[] = [];
  let total = 0;

  for (const eventName of eventFolders) {
    const reportsPath = `${ONEDRIVE_FOLDER_PATH}/${eventName}/Documents/Reports`;
    const encoded = encodeURIComponent(userId);
    const files = await graphGet(
      token,
      `/users/${encoded}/drive/root:/${reportsPath}:/children?$select=name,file`
    );

    const reportFiles: string[] = files?.value
      ? files.value
          .filter((f: { file?: unknown; name: string }) => f.file && isReport(f.name))
          .map((f: { name: string }) => f.name)
      : [];

    total += reportFiles.length;
    events.push({ name: eventName, count: reportFiles.length, files: reportFiles });
  }

  return { total, events, synced: true, source: "graph-app" };
}

// ── Local filesystem fallback ──────────────────────────────────

function countViaFilesystem() {
  if (!existsSync(LOCAL_BASE)) return null;

  const eventFolders = readdirSync(LOCAL_BASE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);

  const events: { name: string; count: number; files: string[] }[] = [];
  let total = 0;

  for (const eventName of eventFolders) {
    const reportsPath = join(LOCAL_BASE, eventName, "Documents", "Reports");

    if (existsSync(reportsPath) && statSync(reportsPath).isDirectory()) {
      const files = readdirSync(reportsPath).filter(isReport);
      total += files.length;
      events.push({ name: eventName, count: files.length, files });
    } else {
      events.push({ name: eventName, count: 0, files: [] });
    }
  }

  return { total, events, synced: true, source: "filesystem" };
}

// ── Route handler ──────────────────────────────────────────────

export async function GET() {
  try {
    // Strategy 1: Use the signed-in user's delegated token (best — no extra config)
    const session = await auth();
    if (session?.accessToken) {
      const delegatedResult = await countViaDelegatedGraph(session.accessToken);
      if (delegatedResult) {
        return NextResponse.json(delegatedResult, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    // Strategy 2: App credentials (Vercel, no active session, requires ONEDRIVE_USER_EMAIL)
    const appResult = await countViaAppGraph();
    if (appResult) {
      return NextResponse.json(appResult, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Strategy 3: Local filesystem (npm run dev on Mac)
    const fsResult = countViaFilesystem();
    if (fsResult) {
      return NextResponse.json(fsResult, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // None available — return empty but don't crash
    return NextResponse.json(
      {
        total: 0,
        events: [],
        synced: false,
        source: "none",
        hint: "Sign in to connect OneDrive, or set AZURE_* env vars for server-side access.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { total: 0, events: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
