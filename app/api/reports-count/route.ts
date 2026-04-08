/**
 * /api/reports-count
 *
 * Counts every .pptx / .pdf report under TEN/Events/ across ALL years.
 *
 * Strategy: one Graph search call per extension → filter to TEN/Events path
 * → group by year + event. Fast (~1-2s total regardless of folder depth).
 *
 * Three auth strategies in order:
 *  1. Delegated  — signed-in user's session token (/me/drive/)
 *  2. App-creds  — client_credentials (requires ONEDRIVE_USER_EMAIL)
 *  3. Filesystem — local OneDrive sync path (npm run dev)
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

// ── Types ────────────────────────────────────────────────────────
type DriveFile = {
  name: string;
  parentReference?: { path?: string };
  file?: unknown;
  folder?: unknown;
};

type EventResult = { name: string; year: string; count: number; files: string[] };

// ── Graph helpers ────────────────────────────────────────────────

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch ALL pages of a Graph search/list result (handles @odata.nextLink pagination).
 */
async function graphGetAll(token: string, url: string): Promise<DriveFile[]> {
  const items: DriveFile[] = [];
  let next: string | null = url;
  while (next) {
    const data = await graphGet(token, next);
    if (!data?.value) break;
    items.push(...(data.value as DriveFile[]));
    next = data["@odata.nextLink"] ?? null;
  }
  return items;
}

/**
 * Search the drive for all files matching each report extension,
 * then filter to only those under TEN/Events/, and group by year + event.
 *
 * driveBase: "https://graph.microsoft.com/v1.0/me/drive"
 *         or "https://graph.microsoft.com/v1.0/users/{id}/drive"
 */
async function scanViaSearch(token: string, driveBase: string) {
  // Run a search for each extension in parallel
  const searches = await Promise.all(
    REPORT_EXTENSIONS.map((ext) =>
      graphGetAll(
        token,
        `${driveBase}/root/search(q='${encodeURIComponent(ext)}')?$select=name,parentReference,file&$top=200`
      )
    )
  );

  // Flatten and deduplicate by name+path
  const seen = new Set<string>();
  const allFiles: DriveFile[] = [];
  for (const batch of searches) {
    for (const f of batch) {
      if (!f.file) continue; // skip folders that matched
      const key = `${f.parentReference?.path ?? ""}/${f.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        allFiles.push(f);
      }
    }
  }

  // Filter to files living under /TEN/Events/
  const eventFiles = allFiles.filter((f) => {
    const path = f.parentReference?.path ?? "";
    return path.includes("/TEN/Events/") && isReport(f.name);
  });

  // Group: extract year + event from path
  // Path looks like: /drive/root:/TEN/Events/2026/The Texas Grand Tour/Documents/Reports
  const byEvent = new Map<string, EventResult>();
  const yearSet = new Set<string>();

  for (const f of eventFiles) {
    const path = f.parentReference?.path ?? "";
    const match = path.match(/\/TEN\/Events\/(\d{4})\/([^/]+)/);
    if (!match) continue;
    const [, year, event] = match;
    yearSet.add(year);
    const key = `${year}::${event}`;
    if (!byEvent.has(key)) byEvent.set(key, { name: event, year, count: 0, files: [] });
    const entry = byEvent.get(key)!;
    entry.count++;
    entry.files.push(f.name);
  }

  const events = [...byEvent.values()].sort((a, b) =>
    b.year.localeCompare(a.year) || a.name.localeCompare(b.name)
  );
  const years = [...yearSet].sort((a, b) => b.localeCompare(a));
  const total = events.reduce((s, e) => s + e.count, 0);

  return { total, events, years, synced: true, source: "graph-search" };
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
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...scanDirForReports(full));
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
    const yearPath = join(LOCAL_EVENTS_ROOT, year);
    const eventFolders = readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);

    for (const eventName of eventFolders) {
      const files = scanDirForReports(join(yearPath, eventName));
      total += files.length;
      events.push({ name: eventName, year, count: files.length, files });
    }
  }

  return { total, events, years: yearFolders, synced: true, source: "filesystem" };
}

// ── Route handler ────────────────────────────────────────────────

export async function GET() {
  try {
    // Strategy 1: delegated — user's own session token
    const session = await auth();
    if (session?.accessToken) {
      const result = await scanViaSearch(
        session.accessToken,
        "https://graph.microsoft.com/v1.0/me/drive"
      );
      if (result) return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    // Strategy 2: app credentials
    const appToken = await getAppGraphToken();
    const userId = process.env.ONEDRIVE_USER_EMAIL;
    if (appToken && userId) {
      const result = await scanViaSearch(
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
