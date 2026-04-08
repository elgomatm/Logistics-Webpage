/**
 * /api/reports-count
 *
 * Counts all event report files (.pptx / .pdf) in the user's OneDrive.
 *
 * Strategy:
 *  1. Try folder traversal (TEN → Events → Year → Event)
 *  2. Fall back to drive-wide search for .pptx / .pdf files (works even when
 *     TEN is buried or the root listing doesn't expose it)
 *
 * Auth strategies (in order):
 *  1. Stored refresh token  — ONEDRIVE_REFRESH_TOKEN Vercel env var (preferred,
 *     works 24/7 without any user being signed in)
 *  2. Active session token  — signed-in user's delegated token
 *  3. Filesystem            — local OneDrive sync path (npm run dev only)
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

// ── Direct-path count (fastest — uses known folder structure) ────────────────

/**
 * Navigates TEN/Events/{year}/[event]/Documents/Reports directly by path.
 * Graph API resolves OneDrive shortcuts via path even when they don't appear
 * in root/children listings, which is why folder-traversal fails but this works.
 */
async function countViaDirectPath(
  token: string,
  year: string
): Promise<{ total: number; events: EventResult[]; years: string[]; synced: boolean; source: string } | null> {
  const driveBase = "https://graph.microsoft.com/v1.0/me/drive";

  // Step 1: list all event folders under TEN/Events/{year}
  const eventsUrl =
    `${driveBase}/root:/TEN/Events/${year}:/children?$select=name,id,folder,remoteItem&$top=500`;
  const eventsRes: Response = await fetch(eventsUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!eventsRes.ok) return null;

  const eventsData = (await eventsRes.json()) as { value?: DriveItem[] };
  const eventFolders = (eventsData?.value ?? []).filter((i) => i.folder);
  if (eventFolders.length === 0) return null;

  // Step 2: for each event, count .pptx/.pdf files in Documents/Reports
  const results = await Promise.all(
    eventFolders.map(async (event): Promise<EventResult> => {
      const { driveBase: edb, itemId: eid } = resolveItem(
        event,
        driveBase
      );

      // Try Documents/Reports subfolder first, then Documents root, then event root
      const candidates = [
        `${edb}/items/${eid}:/Documents/Reports:/children?$select=name,id,file&$top=500`,
        `${edb}/items/${eid}:/Documents:/children?$select=name,id,file&$top=500`,
        `${edb}/items/${eid}/children?$select=name,id,file&$top=500`,
      ];

      for (const url of candidates) {
        const res: Response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { value?: DriveItem[] };
        const files = (data?.value ?? [])
          .filter((f) => f.file && isReport(f.name))
          .map((f) => f.name);
        if (files.length > 0) {
          return { name: event.name, year, count: files.length, files };
        }
      }
      return { name: event.name, year, count: 0, files: [] };
    })
  );

  const total = results.reduce((s, e) => s + e.count, 0);
  return { total, events: results, years: [year], synced: true, source: "direct_path" };
}

// ── Search-based count (fallback when folder traversal can't find TEN) ───────

/**
 * Searches the entire drive for .pptx and .pdf files.
 * Works regardless of folder structure — no path assumptions needed.
 * Groups results by year/event extracted from the parent path.
 */
async function countViaSearch(
  token: string,
  driveBase: string
): Promise<{ total: number; events: EventResult[]; years: string[]; synced: boolean; source: string } | null> {
  const seenIds = new Set<string>();
  const allFiles: Array<{ name: string; id: string; path: string }> = [];

  for (const term of [".pptx", ".pdf", ".ppt"]) {
    let url: string | null =
      `${driveBase}/root/search(q='${encodeURIComponent(term)}')?$select=name,id,parentReference&$top=500`;

    while (url) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data = (await res.json()) as {
        value?: Array<{ name: string; id: string; parentReference?: { path: string; driveId: string } }>;
        "@odata.nextLink"?: string;
      };

      for (const item of data?.value ?? []) {
        if (!seenIds.has(item.id) && isReport(item.name)) {
          seenIds.add(item.id);
          allFiles.push({
            name: item.name,
            id: item.id,
            path: item.parentReference?.path ?? "",
          });
        }
      }

      url = data["@odata.nextLink"] ?? null;
    }
  }

  if (allFiles.length === 0) return null;

  // Extract year / event name from Graph path segments.
  // Paths look like: /drives/{id}/root:/TEN/Events/2025/Event Name/...
  const eventMap = new Map<string, EventResult>();
  const yearSet = new Set<string>();

  for (const file of allFiles) {
    const yearMatch = file.path.match(/\/(20\d{2})\//);
    const year = yearMatch?.[1] ?? "Unknown";
    yearSet.add(year);

    // Segment right after the year is the event folder name
    const afterYear = file.path.split(`/${year}/`)[1];
    const eventName = afterYear ? afterYear.split("/")[0] : "General";
    const key = `${year}::${eventName}`;

    if (!eventMap.has(key)) {
      eventMap.set(key, { name: eventName, year, count: 0, files: [] });
    }
    const ev = eventMap.get(key)!;
    ev.count++;
    ev.files.push(file.name);
  }

  const events = Array.from(eventMap.values()).sort(
    (a, b) => b.year.localeCompare(a.year) || a.name.localeCompare(b.name)
  );
  const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

  return { total: allFiles.length, events, years, synced: true, source: "search" };
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

// ── Refresh token → fresh access token ──────────────────────────────────────

/**
 * Exchange a stored refresh token for a fresh access token.
 * Uses ONEDRIVE_REFRESH_TOKEN env var — set this once via /api/setup-token.
 * This lets the app read OneDrive 24/7 without any user being signed in.
 */
/**
 * Exchange the stored refresh token for a fresh access token.
 * Microsoft rotates refresh tokens on each use — the new one is returned in
 * the response but we can't update the Vercel env var at runtime, so the stored
 * token will eventually go stale. Re-run /api/setup-token and update Vercel
 * whenever you see tokenSource flipping to "session".
 */
async function getAccessTokenFromRefreshToken(): Promise<{ token?: string; error?: string } | null> {
  const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!refreshToken || !AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) return null;
  try {
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
          scope: "https://graph.microsoft.com/Files.Read offline_access",
        }),
        cache: "no-store",
      }
    );
    const data = await res.json();
    if (data.access_token) return { token: data.access_token };
    // Surface the exact MSAL error so it shows in /api/reports-debug output
    return { error: `${data.error}: ${data.error_description ?? "unknown"}` };
  } catch (e) {
    return { error: String(e) };
  }
}

// ── App-credential token (fallback — requires admin consent) ─────────────────

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
    const DRIVE_BASE = "https://graph.microsoft.com/v1.0/me/drive";
    const NO_CACHE = { "Cache-Control": "no-store" };

    const currentYear = new Date().getFullYear().toString();

    // ── Helper: try all strategies with a given token ────────────────────────
    async function tryWithToken(token: string, label: string) {
      // Attempt 1: direct path (TEN/Events/2026/event/Documents/Reports) — fastest
      const directResult = await countViaDirectPath(token, currentYear);
      if (directResult) {
        return NextResponse.json({ ...directResult, source: `${label}_direct` }, { headers: NO_CACHE });
      }
      // Attempt 2: structured folder walk (TEN → Events → Year → Event)
      const folderResult = await scanViaGraph(token, DRIVE_BASE);
      if (folderResult) {
        return NextResponse.json({ ...folderResult, source: label }, { headers: NO_CACHE });
      }
      // Attempt 3: drive-wide search (works when TEN isn't reachable by path)
      const searchResult = await countViaSearch(token, DRIVE_BASE);
      if (searchResult) {
        return NextResponse.json({ ...searchResult, source: `${label}_search` }, { headers: NO_CACHE });
      }
      return null;
    }

    // ── Strategy 1: stored refresh token (24/7, no active session needed) ───
    // Refresh token stored as ONEDRIVE_REFRESH_TOKEN in Vercel env vars.
    // If you see source:"session*" instead of "refresh_token*", the stored
    // token has rotated — visit /api/setup-token and update Vercel.
    const rtResult = await getAccessTokenFromRefreshToken();
    if (rtResult?.token) {
      const res = await tryWithToken(rtResult.token, "refresh_token");
      if (res) return res;
    }

    // ── Strategy 2: active user session (works when Malook is signed in) ────
    const session = await auth();
    if (session?.accessToken) {
      const res = await tryWithToken(session.accessToken, "session");
      if (res) return res;
    }

    // ── Strategy 3: app credentials (requires admin consent — not yet granted) ─
    const appToken = await getAppGraphToken();
    const userId = process.env.ONEDRIVE_USER_EMAIL;
    if (appToken && userId) {
      const result = await scanViaGraph(
        appToken,
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId!)}/drive`
      );
      if (result) return NextResponse.json(result, { headers: NO_CACHE });
    }

    // ── Strategy 4: local filesystem (dev only) ──────────────────────────────
    const fsResult = countViaFilesystem();
    if (fsResult) return NextResponse.json(fsResult, { headers: NO_CACHE });

    // Surface refresh token error if that's why we got here
    const rtError = rtResult && "error" in rtResult ? rtResult.error : undefined;
    return NextResponse.json(
      {
        total: 0, events: [], years: [], synced: false, source: "none",
        hint: "Sign in with Microsoft to connect OneDrive.",
        ...(rtError && { refreshTokenError: rtError }),
      },
      { headers: NO_CACHE }
    );
  } catch (err) {
    return NextResponse.json(
      { total: 0, events: [], years: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
