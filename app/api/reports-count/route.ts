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
import { unstable_cache } from "next/cache";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";

const LOCAL_EVENTS_ROOT =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events";

const REPORT_EXTENSIONS = [".pptx", ".ppt"];

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
 * Discover the TEN folder using the Microsoft Search API.
 * TEN lives on Adonis Ordonez's OneDrive, shared with the signed-in user.
 * The Graph sharedWithMe endpoint misses folders shared at the OneDrive level —
 * the Search API searches ALL content the user can access, including those.
 */
async function findTENFolder(
  token: string,
  userDriveBase: string
): Promise<{ driveBase: string; itemId: string } | null> {
  // 1. Microsoft Search API — finds TEN across all accessible drives/SharePoint
  console.log("[findTEN] searching via Microsoft Search API...");
  const searchRes = await fetch("https://graph.microsoft.com/v1.0/search/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        entityTypes: ["driveItem"],
        query: { queryString: "TEN" },
        fields: ["name", "id", "parentReference"],
        from: 0, size: 25,
      }],
    }),
    cache: "no-store",
  });
  console.log("[findTEN] search status:", searchRes.status);
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const hits: Array<{ hitId: string; resource: { name: string; parentReference?: { driveId: string } } }> =
      searchData?.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
    console.log("[findTEN] search hits:", hits.map((h) => h.resource?.name));
    const tenHit = hits.find((h) => h.resource?.name?.toLowerCase() === "ten");
    if (tenHit) {
      const driveId = tenHit.resource.parentReference?.driveId;
      const itemId = tenHit.hitId;
      if (driveId && itemId) {
        console.log("[findTEN] found TEN via search! driveId:", driveId);
        return {
          driveBase: `https://graph.microsoft.com/v1.0/drives/${driveId}`,
          itemId,
        };
      }
    }
  }

  // 2. Fall back: sharedWithMe (catches direct-share links)
  console.log("[findTEN] search missed, trying sharedWithMe...");
  const sharedRes = await fetch(
    "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$select=name,id,remoteItem&$top=200",
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (sharedRes.ok) {
    const sharedData = await sharedRes.json();
    const sharedItems = (sharedData?.value ?? []) as DriveItem[];
    const tenShared = sharedItems.find((i) => i.name.toLowerCase() === "ten");
    if (tenShared) {
      console.log("[findTEN] found TEN in sharedWithMe");
      return resolveItem(tenShared, userDriveBase);
    }
  }

  // 3. Fall back: personal drive root
  const rootRes = await fetch(
    `${userDriveBase}/root/children?$select=name,id,folder,remoteItem&$top=500`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (rootRes.ok) {
    const rootData = await rootRes.json();
    const rootItems = (rootData?.value ?? []) as DriveItem[];
    const tenItem = rootItems.find((i) => i.name.toLowerCase() === "ten");
    if (tenItem) {
      console.log("[findTEN] found TEN in drive root");
      return resolveItem(tenItem, userDriveBase);
    }
  }

  console.log("[findTEN] FAILED — TEN not found via search, sharedWithMe, or root");
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
  const userDriveBase = "https://graph.microsoft.com/v1.0/me/drive";

  // Step 0: Find TEN (it's shared from Adonis Ordonez's OneDrive, not on me/drive)
  const ten = await findTENFolder(token, userDriveBase);
  if (!ten) {
    console.log("[direct_path] FAILED - could not locate TEN folder");
    return null;
  }

  // Step 1: Navigate TEN → Events → {year}
  const eventsUrl = `${ten.driveBase}/items/${ten.itemId}:/Events/${year}:/children?$select=name,id,folder,remoteItem&$top=500`;
  console.log("[direct_path] fetching events url:", eventsUrl);
  const eventsRes: Response = await fetch(eventsUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  console.log("[direct_path] events response status:", eventsRes.status);
  if (!eventsRes.ok) {
    const errText = await eventsRes.text();
    console.log("[direct_path] FAILED - response body:", errText.slice(0, 500));
    return null;
  }

  const eventsData = (await eventsRes.json()) as { value?: DriveItem[] };
  const eventFolders = (eventsData?.value ?? []).filter((i) => i.folder);
  console.log("[direct_path] event folders found:", eventFolders.map((f) => f.name));
  if (eventFolders.length === 0) {
    console.log("[direct_path] FAILED - no event folders under TEN/Events/" + year);
    return null;
  }

  // Step 2: for each event, count .pptx/.pdf files in Documents/Reports
  const results = await Promise.all(
    eventFolders.map(async (event): Promise<EventResult> => {
      const { driveBase: edb, itemId: eid } = resolveItem(
        event,
        ten.driveBase
      );

      // Check Documents/Reports — and one level deeper in case reports are in a subfolder
      // (e.g. Lone Star Supercars stores reports in Documents/Reports/pptm/)
      async function fetchReportFiles(url: string): Promise<string[]> {
        const res: Response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { value?: DriveItem[] };
        const items = data?.value ?? [];

        // Collect .pptx/.ppt files directly in Reports/
        const directFiles = items.filter((f) => f.file && isReport(f.name)).map((f) => f.name);

        // ALWAYS scan one level deeper into any subfolders (e.g. Reports/pptm/, Reports/PPTs/)
        // Some events store all files in a subfolder, others mix direct + subfolder
        const subFolders = items.filter((f) => f.folder);
        const nestedFiles = subFolders.length > 0
          ? (await Promise.all(
              subFolders.map(async (sub) => {
                const { driveBase: sdb, itemId: sid } = resolveItem(sub, edb);
                const subRes: Response = await fetch(
                  `${sdb}/items/${sid}/children?$select=name,id,file&$top=500`,
                  { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
                );
                if (!subRes.ok) return [];
                const subData = (await subRes.json()) as { value?: DriveItem[] };
                return (subData?.value ?? []).filter((f) => f.file && isReport(f.name)).map((f) => f.name);
              })
            )).flat()
          : [];

        // Combine and deduplicate
        return Array.from(new Set([...directFiles, ...nestedFiles]));
      }

      // Only count files in Documents/Reports (or one level deeper for subfolders like pptm/).
      // Do NOT fall back to Documents root — that folder contains MEPs, SOPs, and other
      // non-report files that should not be counted.
      const reportsUrl = `${edb}/items/${eid}:/Documents/Reports:/children?$select=name,id,file,folder,remoteItem&$top=500`;
      const fromReports = await fetchReportFiles(reportsUrl);
      console.log(`[direct_path] ${event.name} -> Documents/Reports: ${fromReports.length} files`, fromReports);
      if (fromReports.length > 0) {
        return { name: event.name, year, count: fromReports.length, files: fromReports };
      }

      console.log(`[direct_path] ${event.name} -> no Reports folder or empty, skipping`);
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
        const parentPath = item.parentReference?.path ?? "";
        const pathLower = parentPath.toLowerCase();

        if (isReport(item.name)) {
          // Log every report-like file with its path so we can verify filtering
          console.log("[search] found:", item.name, "| path:", parentPath);
        }

        // TEN files live on a SharePoint drive — when Graph returns them via search,
        // the path looks like /drives/{id}/root:/Events/2026/EventName/...
        // "TEN" is the library root and does NOT appear in the path string.
        // Filter: require a 20XX year segment in the path — personal files like
        // insurance PDFs and bank statements won't have this structure.
        const hasYear = /\/20\d{2}\//.test(parentPath);

        if (!seenIds.has(item.id) && isReport(item.name) && hasYear) {
          seenIds.add(item.id);
          allFiles.push({
            name: item.name,
            id: item.id,
            path: parentPath,
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
            const directReports = rfItems.filter((f) => f.file && isReport(f.name)).map((f) => f.name);

            if (directReports.length > 0) {
              reportsFromReportsFolder = directReports;
            } else {
              // Reports folder contains subfolders (e.g. pptm/) — scan one level deeper
              const subfolders = rfItems.filter((f) => f.folder);
              const nested = await Promise.all(
                subfolders.map(async (sub) => {
                  const { driveBase: sdb, itemId: sid } = resolveItem(sub, rdb);
                  const subItems = await graphChildren(token, sdb, sid);
                  return subItems.filter((f) => f.file && isReport(f.name)).map((f) => f.name);
                })
              );
              reportsFromReportsFolder = nested.flat();
            }
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
          scope: "https://graph.microsoft.com/Files.Read.All offline_access",
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

// ── Cached fetch — persists result in Vercel Data Cache for 1 hour ───────────
// unstable_cache stores the result server-side so every visitor gets an instant
// response after the first fetch. The cron job at /api/warm-cache keeps it warm.

const fetchReportsCount = unstable_cache(
  async (): Promise<{ total: number; events: EventResult[]; years: string[]; synced: boolean; source: string; refreshTokenError?: string }> => {
    const DRIVE_BASE = "https://graph.microsoft.com/v1.0/me/drive";
    const currentYear = new Date().getFullYear().toString();
    console.log("[reports-count] cache MISS — fetching fresh data", { currentYear });

    async function tryWithToken(token: string, label: string) {
      // Primary: sharedWithMe → TEN → Events → year (correct path for Adonis's shared drive)
      console.log(`[reports-count] [${label}] trying direct path via sharedWithMe...`);
      const directResult = await countViaDirectPath(token, currentYear);
      if (directResult && directResult.total > 0) {
        console.log(`[reports-count] [${label}] direct path SUCCESS:`, directResult.total, "files");
        return { ...directResult, source: `${label}_direct` };
      }

      // Fallback: search across all drives the user has access to
      console.log(`[reports-count] [${label}] direct path failed, searching all drives...`);
      const drivesRes = await fetch(`https://graph.microsoft.com/v1.0/me/drives`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (drivesRes.ok) {
        const drivesData = await drivesRes.json() as { value?: Array<{ id: string; name: string; driveType: string }> };
        const drives = drivesData?.value ?? [];
        console.log(`[reports-count] [${label}] drives:`, drives.map((d) => `${d.name}(${d.driveType})`));
        for (const drive of drives) {
          const driveBase = `https://graph.microsoft.com/v1.0/drives/${drive.id}`;
          const result = await countViaSearch(token, driveBase);
          if (result && result.total > 0) {
            console.log(`[reports-count] [${label}] found ${result.total} files on drive: ${drive.name}`);
            return { ...result, source: `${label}_drive` };
          }
        }
      }

      // Last resort: search personal drive
      const searchResult = await countViaSearch(token, DRIVE_BASE);
      if (searchResult && searchResult.total > 0) {
        console.log(`[reports-count] [${label}] personal drive search found:`, searchResult.total);
        return { ...searchResult, source: `${label}_search` };
      }

      return null;
    }

    // NOTE: auth() cannot be called inside unstable_cache — it uses headers() internally
    // which is a dynamic data source. Session-token fallback lives in the GET handler below.
    // Only the stored refresh token (env var, no headers needed) is used here.
    const hasRefreshToken = !!process.env.ONEDRIVE_REFRESH_TOKEN;
    console.log("[reports-count] ONEDRIVE_REFRESH_TOKEN present:", hasRefreshToken);
    const rtResult = await getAccessTokenFromRefreshToken();
    if (rtResult?.error) console.log("[reports-count] refresh token error:", rtResult.error);
    if (rtResult?.token) {
      const result = await tryWithToken(rtResult.token, "refresh_token");
      if (result) return result;
    }

    const rtError = rtResult?.error;
    console.log("[reports-count] refresh token strategy failed — session fallback handled in GET handler");
    return {
      total: 0, events: [], years: [], synced: false, source: "none",
      ...(rtError && { refreshTokenError: rtError }),
    };
  },
  ["reports-count-v2"],          // bumped from v1 — logic changed
  { revalidate: 3600 }           // refresh every hour
);

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const DRIVE_BASE = "https://graph.microsoft.com/v1.0/me/drive";

  try {
    // Dev: always use filesystem so local changes are reflected immediately
    if (process.env.NODE_ENV !== "production") {
      const fsResult = countViaFilesystem();
      if (fsResult) return NextResponse.json(fsResult);
    }

    // Strategy 1: cached refresh-token path (works 24/7, no session needed)
    const cached = await fetchReportsCount();
    if (cached.total > 0) {
      return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
    }

    // Strategy 2: active session token — auth() uses headers() so it MUST live outside
    // unstable_cache. Runs uncached on every request when the refresh-token path fails
    // (e.g. ONEDRIVE_REFRESH_TOKEN not yet set in Vercel, or token expired).
    const session = await auth();
    console.log("[reports-count] session accessToken present:", !!session?.accessToken);
    if (session?.accessToken) {
      const currentYear = new Date().getFullYear().toString();

      // Primary: sharedWithMe → TEN → Events (TEN is on Adonis Ordonez's drive, shared with Malik)
      const directResult = await countViaDirectPath(session.accessToken, currentYear);
      if (directResult && directResult.total > 0) {
        console.log("[reports-count] session_direct SUCCESS:", directResult.total);
        return NextResponse.json(
          { ...directResult, source: "session_direct" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      // Fallback: search across all accessible drives
      const drivesRes = await fetch("https://graph.microsoft.com/v1.0/me/drives", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
      if (drivesRes.ok) {
        const drivesData = (await drivesRes.json()) as { value?: Array<{ id: string; name: string; driveType: string }> };
        for (const drive of drivesData?.value ?? []) {
          const driveBase = `https://graph.microsoft.com/v1.0/drives/${drive.id}`;
          const result = await countViaSearch(session.accessToken, driveBase);
          if (result && result.total > 0) {
            console.log("[reports-count] session_drive_search SUCCESS on:", drive.name, result.total);
            return NextResponse.json(
              { ...result, source: "session_drive_search" },
              { headers: { "Cache-Control": "no-store" } }
            );
          }
        }
      }

      // Last resort: personal drive search
      const searchResult = await countViaSearch(session.accessToken, DRIVE_BASE);
      if (searchResult && searchResult.total > 0) {
        console.log("[reports-count] session_search SUCCESS:", searchResult.total);
        return NextResponse.json(
          { ...searchResult, source: "session_search" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // All strategies failed — return cached result (includes any error info)
    return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.log("[reports-count] UNCAUGHT ERROR:", err);
    return NextResponse.json(
      { total: 0, events: [], years: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
