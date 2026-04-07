/**
 * /api/reports-count
 *
 * Reads the TEN Events/2026 folder and counts .pptx/.pdf report files
 * per event by trying two strategies, in order:
 *
 *  1. Microsoft Graph API (works on Vercel)
 *     Set these environment variables in Vercel → Settings → Environment Variables:
 *       AZURE_TENANT_ID         — from Azure AD > App Registration > Overview
 *       AZURE_CLIENT_ID         — same location
 *       AZURE_CLIENT_SECRET     — Azure AD > Certificates & Secrets
 *       ONEDRIVE_USER_EMAIL     — your Microsoft 365 email (e.g. malook@theexoticsnetwork.com)
 *
 *     Required API permissions on the app registration (Application permissions, admin consent):
 *       Microsoft Graph > Files.Read.All
 *
 *  2. Local filesystem fallback (works when running `npm run dev` on your Mac)
 *     No setup needed — reads directly from the synced OneDrive path.
 */

import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Constants ──────────────────────────────────────────────────
const LOCAL_BASE =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events/2026";

const ONEDRIVE_FOLDER_PATH = "TEN/Events/2026";

const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReport(name: string) {
  const lc = name.toLowerCase();
  return REPORT_EXTENSIONS.some((ext) => lc.endsWith(ext));
}

// ── Microsoft Graph API helpers ────────────────────────────────

async function getGraphToken(): Promise<string | null> {
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

async function graphGet(token: string, path: string) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function countViaGraphAPI() {
  const token = await getGraphToken();
  if (!token) return null;

  const userId = process.env.ONEDRIVE_USER_EMAIL;
  if (!userId) return null;

  // List 2026 event folders
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

  return { total, events, synced: true, source: "graph" };
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
    // Try Graph API first (Vercel deployment)
    const graphResult = await countViaGraphAPI();
    if (graphResult) {
      return NextResponse.json(graphResult, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Fall back to local filesystem (npm run dev on your Mac)
    const fsResult = countViaFilesystem();
    if (fsResult) {
      return NextResponse.json(fsResult, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Neither source available — return empty but don't crash
    return NextResponse.json(
      {
        total: 0,
        events: [],
        synced: false,
        source: "none",
        hint: "Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, ONEDRIVE_USER_EMAIL in Vercel env vars to enable OneDrive sync.",
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
