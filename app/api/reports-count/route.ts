/**
 * /api/reports-count
 *
 * Dynamically discovers the TEN folder in the signed-in user's OneDrive —
 * works whether TEN is a regular folder or a shortcut/remote-item.
 *
 * Discovery order:
 *  1. List /me/drive/root/children → look for "TEN" (handles remoteItem shortcuts)
 *  2. Inside TEN, look for "Events" subfolder
 *  3. Year → Event → Documents/Reports — all fetched with Promise.all()
 *
 * Auth strategies (in order):
 *  1. Delegated  — signed-in user's session token (preferred)
 *  2. App-creds  — client_credentials + ONEDRIVE_USER_EMAIL
 *  3. Filesystem — local OneDrive sync path (npm run dev fallback)
 */

import { NextResponse } from "next/server";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";

const LOCAL_EVENTS_ROOT =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events";

const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReport(name: string) {
  return REPORT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

type DriveItem = {
  name: string;
  id: string;
  folder?: unknown;
  file?: unknown;
  remoteItem?: {
    id: string;
    parentReference?: { driveId?: string };
    driveId?: string;
  };
};

type EventResult = { name: string; year: string; count: number; files: string[] };

// ── Graph helpers ────────────────────────────────────────────────────────────

/** List children of a folder by item ID (works for both own and remote drives) */
async function graphChildren(
  token: string,
  driveBase: string,
  itemId: string
): Promise<DriveItem[]> {
  const url = `${driveBase}/items/${itemId}/children?$select=name,id,file,folder,remoteItem&$top=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.value ?? []) as DriveItem[];
}

/** Get a specific child by name under a known item ID */
async function graphChildByName(
  token: string,
  driveBase: string,
  itemId: string,
  name: string
): Promise<DriveItem | null> {
  const encoded = encodeURIComponent(name);
  // Try direct path first (faster)
  const url = `${driveBase}/items/${itemId}:/${encoded}:?$select=name,id,folder,remoteItem`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) return (await res.json()) as DriveItem;

  // Fallback: list children and find by name
  const children = await graphChildren(token, driveBase, itemId);
  return children.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Discover the TEN folder in the user's drive root.
 * Handles both regular folders and OneDrive shortcuts (remoteItem).
 * Returns { driveBase, itemId } that can be used for subsequent calls.
 */
async function findTENFolder(
  token: string,
  userDriveBase: string
): Promise<{ driveBase: string; itemId: string } | null> {
  // 1. Try root children listing
  const rootUrl = `${userDriveBase}/root/children?$select=name,id,folder,remoteItem&$top=500`;
  const rootRes = await fetch(rootUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!rootRes.ok) return null;
  const rootData = await rootRes.json();
  const rootItems = (rootData?.value ?? []) as DriveItem[];

  const tenItem = rootItems.find((i) => i.name.toLowerCase() === "ten");
  if (tenItem) {
    return resolveItem(tenItem, userDriveBase);
  }

  // 2. If not in root, search for it
  const searchUrl = `${userDriveBase}/root/search(q='TEN')?$select=name,id,folder,remoteItem&$top=50`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const searchItems = (searchData?.value ?? []) as DriveItem[];
    // Find a folder named exactly "TEN"
    const exactMatch = searchItems.find(
      (i) => i.name === "TEN" && i.folder
    );
    if (exactMatch) return resolveItem(exactMatch, userDriveBase);
  }

  return null;
}

/** Resolve a DriveItem (regular folder or shortcut) to { driveBase, itemId } */
function resolveItem(
  item: DriveItem,
  fallbackDriveBase: string
): { driveBase: string; itemId: string } {
  if (item.remoteItem) {
    // OneDrive shortcut — lives on a different drive
    const remoteDriveId =
      item.remoteItem.parentReference?.driveId ?? item.remoteItem.driveId;
    const remoteItemId = item.remoteItem.id;
    if (remoteDriveId && remoteItemId) {
      return {
        driveBase: `https://graph.microsoft.com/v1.0/drives/${remoteDriveId}`,
        itemId: remoteItemId,
      };
    }
  }
  // Regular folder on the user's own drive
  return { driveBase: fallbackDriveBase, itemId: item.id };
}

// ── Main scan logic ──────────────────────────────────────────────────────────

async function scanViaGraph(token: string, userDriveBase: string) {
  // Step 1: Find TEN folder (handles shortcuts)
  const ten = await findTENFolder(token, userDriveBase);
  if (!ten) return null;

  // Step 2: Find Events folder inside TEN
  const eventsItem = await graphChildByName(token, ten.driveBase, ten.itemId, "Events");
  if (!eventsItem) return null;

  const { driveBase, itemId: eventsItemId } = resolveItem(eventsItem, ten.driveBase);

  // Step 3: Get year folders
  const yearItems = await graphChildren(token, driveBase, eventsItemId);
  const years = yearItems
    .filter((i) => i.folder)
    .map((i) => i.name)
    .sort((a, b) => b.localeCompare(a));

  if (years.length === 0) return null;

  // Step 4: Get event folders for all years in parallel
  const eventsByYear = await Promise.all(
    years.map(async (year) => {
      const yearItem = yearItems.find((i) => i.name === year)!;
      const { driveBase: ydb, itemId: yid } = resolveItem(yearItem, driveBase);
      const items = await graphChildren(token, ydb, yid);
      const events = items.filter((i) => i.folder);
      return { year, events, driveBase: ydb };
    })
  );

  // Step 5: For each event, scan for reports in parallel
  const allEventResults: EventResult[] = [];

  await Promise.all(
    eventsByYear.flatMap(({ year, events, driveBase: ydb }) =>
      events.map(async (eventItem) => {
        const { driveBase: edb, itemId: eid } = resolveItem(eventItem, ydb);

        // Fetch event root and Documents subfolder in parallel
        const [rootItems, docsSearch] = await Promise.all([
          graphChildren(token, edb, eid),
          graphChildByName(token, edb, eid, "Documents"),
        ]);

        const reportsFromRoot = rootItems
          .filter((f) => f.file && isReport(f.name))
          .map((f) => f.name);

        let reportsFromDocs: string[] = [];
        let reportsFromReportsFolder: string[] = [];

        if (docsSearch) {
          const { driveBase: ddb, itemId: did } = resolveItem(docsSearch, edb);
          const docsItems = await graphChildren(token, ddb, did);

          reportsFromDocs = docsItems
            .filter((f) => f.file && isReport(f.name))
            .map((f) => f.name);

          // Look for Reports subfolder inside Documents
          const reportsFolder = docsItems.find(
            (i) => i.folder && i.name.toLowerCase() === "reports"
          );
          if (reportsFolder) {
            const { driveBase: rdb, itemId: rid } = resolveItem(reportsFolder, ddb);
            const rfItems = await graphChildren(token, rdb, rid);
            reportsFromReportsFolder = rfItems
              .filter((f) => f.file && isReport(f.name))
              .map((f) => f.name);
          }
        }

        const files = Array.from(
          new Set([...reportsFromRoot, ...reportsFromDocs, ...reportsFromReportsFolder])
        );
        allEventResults.push({ name: eventItem.name, year, count: files.length, files });
      })
    )
  );

  const sortedEvents = allEventResults.sort(
    (a, b) => b.year.localeCompare(a.year) || a.name.localeCompare(b.name)
  );
  const total = sortedEvents.reduce((s, e) => s + e.count, 0);

  return { total, events: sortedEvents, years, synced: true, source: "graph" };
}

// ── App-credential token ─────────────────────────────────────────────────────

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

// ── Local filesystem fallback ────────────────────────────────────────────────

function scanDirForReports(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) results.push(...scanDirForReports(join(dir, entry.name)));
    else if (isReport(entry.name)) results.push(entry.name);
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
    const eventFolders = readdirSync(join(LOCAL_EVENTS_ROOT, year), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
    for (const eventName of eventFolders) {
      const files = scanDirForReports(join(LOCAL_EVENTS_ROOT, year, eventName));
      total += files.length;
      events.push({ name: eventName, year, count: files.length, files });
    }
  }
  return { total, events, years: yearFolders, synced: true, source: "filesystem" };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Strategy 1: delegated (signed-in user's session token)
    const session = await auth();
    if (session?.accessToken) {
      const result = await scanViaGraph(
        session.accessToken,
        "https://graph.microsoft.com/v1.0/me/drive"
      );
      if (result) return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    // Strategy 2: app credentials
    const appToken = await getAppGraphToken();
    const userId = process.env.ONEDRIVE_USER_EMAIL;
    if (appToken && userId) {
      const result = await scanViaGraph(
        appToken,
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/drive`
      );
      if (result) return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    // Strategy 3: local filesystem
    const fsResult = countViaFilesystem();
    if (fsResult) return NextResponse.json(fsResult, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json(
      {
        total: 0, events: [], years: [], synced: false, source: "none",
        hint: "Sign in with Microsoft to connect OneDrive.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { total: 0, events: [], years: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
