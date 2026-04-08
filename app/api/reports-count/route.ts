/**
 * /api/reports-count
 *
 * Scans TEN/Events/ across ALL years and ALL events, counting every
 * .pptx / .ppt / .pdf report file found anywhere inside each event folder.
 *
 * Three strategies tried in order:
 *  1. Delegated Graph API  — uses the signed-in user's session token (/me/drive/)
 *  2. App-credential Graph — falls back if no session (requires ONEDRIVE_USER_EMAIL)
 *  3. Local filesystem     — works on your Mac with npm run dev
 */

import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";

// ── Constants ────────────────────────────────────────────────────
const LOCAL_EVENTS_ROOT =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events";

const GRAPH_EVENTS_PATH = "TEN/Events";

const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReport(name: string) {
  const lc = name.toLowerCase();
  return REPORT_EXTENSIONS.some((ext) => lc.endsWith(ext));
}

// ── Graph helpers ────────────────────────────────────────────────

async function graphGet(token: string, path: string) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

type DriveItem = { name: string; folder?: unknown; file?: unknown };
type EventResult = { name: string; year: string; count: number; files: string[] };

/**
 * Recursively count all report files inside an event folder via Graph API.
 * Uses search so it catches files nested in any subfolder (Reports/, Documents/, etc.)
 */
async function countReportsInEventGraph(
  token: string,
  drivePrefix: string, // e.g. "/me/drive" or "/users/{id}/drive"
  eventPath: string    // e.g. "TEN/Events/2026/The Texas Grand Tour"
): Promise<{ count: number; files: string[] }> {
  // Use Graph search within the event folder for all report file types
  const encoded = encodeURIComponent(eventPath);
  const data = await graphGet(
    token,
    `${drivePrefix}/root:/${encoded}:/children?$select=name,file,folder&$top=200`
  );

  if (!data?.value) return { count: 0, files: [] };

  const files: string[] = [];

  const processItems = async (items: DriveItem[], currentPath: string) => {
    for (const item of items) {
      if (item.file && isReport(item.name)) {
        files.push(item.name);
      } else if (item.folder) {
        // Recurse into subfolders
        const subPath = `${currentPath}/${item.name}`;
        const subData = await graphGet(
          token,
          `${drivePrefix}/root:/${encodeURIComponent(subPath)}:/children?$select=name,file,folder&$top=200`
        );
        if (subData?.value) {
          await processItems(subData.value as DriveItem[], subPath);
        }
      }
    }
  };

  await processItems(data.value as DriveItem[], eventPath);
  return { count: files.length, files };
}

/**
 * Strategy 1: Delegated auth — signed-in user's token, /me/drive/
 */
async function countViaDelegatedGraph(accessToken: string) {
  const drivePrefix = "/me/drive";

  // Get all year folders under TEN/Events/
  const yearsData = await graphGet(
    accessToken,
    `${drivePrefix}/root:/${GRAPH_EVENTS_PATH}:/children?$select=name,folder`
  );
  if (!yearsData?.value) return null;

  const yearFolders: string[] = (yearsData.value as DriveItem[])
    .filter((i) => i.folder)
    .map((i) => i.name)
    .sort((a, b) => b.localeCompare(a)); // newest year first

  const events: EventResult[] = [];
  let total = 0;

  for (const year of yearFolders) {
    const eventsData = await graphGet(
      accessToken,
      `${drivePrefix}/root:/${GRAPH_EVENTS_PATH}/${year}:/children?$select=name,folder`
    );
    if (!eventsData?.value) continue;

    const eventFolders: string[] = (eventsData.value as DriveItem[])
      .filter((i) => i.folder)
      .map((i) => i.name);

    for (const eventName of eventFolders) {
      const eventPath = `${GRAPH_EVENTS_PATH}/${year}/${eventName}`;
      const { count, files } = await countReportsInEventGraph(accessToken, drivePrefix, eventPath);
      total += count;
      events.push({ name: eventName, year, count, files });
    }
  }

  return { total, events, years: yearFolders, synced: true, source: "graph-delegated" };
}

/**
 * Strategy 2: App credentials — client_credentials flow
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
  } catch { return null; }
}

async function countViaAppGraph() {
  const token = await getAppGraphToken();
  if (!token) return null;
  const userId = process.env.ONEDRIVE_USER_EMAIL;
  if (!userId) return null;

  const drivePrefix = `/users/${encodeURIComponent(userId)}/drive`;

  const yearsData = await graphGet(
    token,
    `${drivePrefix}/root:/${GRAPH_EVENTS_PATH}:/children?$select=name,folder`
  );
  if (!yearsData?.value) return null;

  const yearFolders: string[] = (yearsData.value as DriveItem[])
    .filter((i) => i.folder)
    .map((i) => i.name)
    .sort((a, b) => b.localeCompare(a));

  const events: EventResult[] = [];
  let total = 0;

  for (const year of yearFolders) {
    const eventsData = await graphGet(
      token,
      `${drivePrefix}/root:/${GRAPH_EVENTS_PATH}/${year}:/children?$select=name,folder`
    );
    if (!eventsData?.value) continue;

    const eventFolders: string[] = (eventsData.value as DriveItem[])
      .filter((i) => i.folder)
      .map((i) => i.name);

    for (const eventName of eventFolders) {
      const eventPath = `${GRAPH_EVENTS_PATH}/${year}/${eventName}`;
      const { count, files } = await countReportsInEventGraph(token, drivePrefix, eventPath);
      total += count;
      events.push({ name: eventName, year, count, files });
    }
  }

  return { total, events, years: yearFolders, synced: true, source: "graph-app" };
}

/**
 * Strategy 3: Local filesystem — recursive scan of all years/events
 */
function scanDirForReports(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirForReports(fullPath));
    } else if (isReport(entry.name)) {
      results.push(entry.name);
    }
  }
  return results;
}

function countViaFilesystem() {
  if (!existsSync(LOCAL_EVENTS_ROOT)) return null;

  const yearFolders = readdirSync(LOCAL_EVENTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort((a, b) => b.localeCompare(a));

  const events: EventResult[] = [];
  let total = 0;

  for (const year of yearFolders) {
    const yearPath = join(LOCAL_EVENTS_ROOT, year);
    const eventFolders = readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);

    for (const eventName of eventFolders) {
      const eventPath = join(yearPath, eventName);
      const files = scanDirForReports(eventPath);
      total += files.length;
      events.push({ name: eventName, year, count: files.length, files });
    }
  }

  return { total, events, years: yearFolders, synced: true, source: "filesystem" };
}

// ── Route handler ────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (session?.accessToken) {
      const result = await countViaDelegatedGraph(session.accessToken);
      if (result) return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    const appResult = await countViaAppGraph();
    if (appResult) return NextResponse.json(appResult, { headers: { "Cache-Control": "no-store" } });

    const fsResult = countViaFilesystem();
    if (fsResult) return NextResponse.json(fsResult, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json(
      { total: 0, events: [], years: [], synced: false, source: "none",
        hint: "Sign in with Microsoft to connect OneDrive." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { total: 0, events: [], years: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
