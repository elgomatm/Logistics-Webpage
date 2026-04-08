/**
 * /api/reports-count
 *
 * Counts every .pptx / .pdf report under TEN/Events/ across ALL years.
 *
 * Uses parallel Promise.all() folder listing — reliable and fast:
 *   1 call  → year folders
 *   N calls → event folders per year        (all parallel)
 *   N calls → Documents/Reports per event   (all parallel)
 *
 * Three auth strategies:
 *  1. Delegated  — signed-in user's session token
 *  2. App-creds  — client_credentials (requires ONEDRIVE_USER_EMAIL)
 *  3. Filesystem — local OneDrive sync path (npm run dev)
 */

import { NextResponse } from "next/server";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";

const LOCAL_EVENTS_ROOT =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events";

const GRAPH_EVENTS_PATH = "TEN/Events";
const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReport(name: string) {
  return REPORT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

type DriveItem = { name: string; folder?: unknown; file?: unknown };
type EventResult = { name: string; year: string; count: number; files: string[] };

// ── Graph helpers ────────────────────────────────────────────────

async function graphList(token: string, driveBase: string, path: string): Promise<DriveItem[]> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const url = `${driveBase}/root:/${encoded}:/children?$select=name,file,folder&$top=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.value ?? []) as DriveItem[];
}

async function scanViaGraph(token: string, driveBase: string) {
  // Step 1: get year folders
  const yearItems = await graphList(token, driveBase, GRAPH_EVENTS_PATH);
  const years = yearItems
    .filter((i) => i.folder)
    .map((i) => i.name)
    .sort((a, b) => b.localeCompare(a));

  if (years.length === 0) return null;

  // Step 2: get event folders for all years in parallel
  const eventsByYear = await Promise.all(
    years.map(async (year) => {
      const items = await graphList(token, driveBase, `${GRAPH_EVENTS_PATH}/${year}`);
      const events = items.filter((i) => i.folder).map((i) => i.name);
      return { year, events };
    })
  );

  // Step 3: get report files for every event in parallel
  // Check both Documents/Reports and root of event folder
  const allEventResults: EventResult[] = [];

  await Promise.all(
    eventsByYear.flatMap(({ year, events }) =>
      events.map(async (eventName) => {
        const basePath = `${GRAPH_EVENTS_PATH}/${year}/${eventName}`;

        // Fetch Documents/Reports and Documents subfolders in parallel
        const [rootItems, docsItems] = await Promise.all([
          graphList(token, driveBase, basePath),
          graphList(token, driveBase, `${basePath}/Documents`),
        ]);

        const reportsFromRoot = rootItems
          .filter((f) => f.file && isReport(f.name))
          .map((f) => f.name);

        // Find Reports subfolder inside Documents
        const hasReportsFolder = docsItems.some(
          (i) => i.folder && i.name.toLowerCase() === "reports"
        );

        let reportsFromReportsFolder: string[] = [];
        if (hasReportsFolder) {
          const reportsItems = await graphList(
            token,
            driveBase,
            `${basePath}/Documents/Reports`
          );
          reportsFromReportsFolder = reportsItems
            .filter((f) => f.file && isReport(f.name))
            .map((f) => f.name);
        }

        // Also check docs root for any report files
        const reportsFromDocs = docsItems
          .filter((f) => f.file && isReport(f.name))
          .map((f) => f.name);

        const files = Array.from(
          new Set(reportsFromRoot.concat(reportsFromDocs, reportsFromReportsFolder))
        );

        allEventResults.push({ name: eventName, year, count: files.length, files });
      })
    )
  );

  const events = allEventResults.sort(
    (a, b) => b.year.localeCompare(a.year) || a.name.localeCompare(b.name)
  );
  const total = events.reduce((s, e) => s + e.count, 0);

  return { total, events, years, synced: true, source: "graph" };
}

// ── App-credential token ─────────────────────────────────────────

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

// ── Local filesystem fallback ────────────────────────────────────

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

// ── Route handler ────────────────────────────────────────────────

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
