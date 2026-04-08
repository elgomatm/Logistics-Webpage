/**
 * /api/onedrive-analytics
 *
 * Returns live OneDrive storage + folder metrics for the TEN drive:
 *   - quota (used / remaining / total)
 *   - top-level folder breakdown (name, size, file count)
 *   - file-type breakdown (extension → count + bytes)
 *   - TEN/Events folder tree with per-event sizes
 */

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/auth";

async function getToken(): Promise<{ token?: string; error?: string }> {
  const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (refreshToken && AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
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
    return { error: data.error_description ?? "refresh token failed" };
  }
  const session = await auth();
  if (session?.accessToken) return { token: session.accessToken };
  return { error: "not authenticated" };
}

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Cached data fetcher (10-minute TTL) ───────────────────────
const fetchAnalyticsData = unstable_cache(
  async (token: string) => {
    return _fetchAnalyticsData(token);
  },
  ["onedrive-analytics-data"],
  { revalidate: 600 } // 10 minutes
);

function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

type DriveItemRaw = {
  name: string;
  id: string;
  size?: number;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { driveId?: string };
};

// ── Core data fetcher (called by unstable_cache) ─────────────
async function _fetchAnalyticsData(token: string) {
  // ── 1. Personal drive quota ───────────────────────────────────
  const driveInfo = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drive?$select=quota,id");
  const quota = driveInfo?.quota ?? null;

  // ── 2. Find TEN drive via Search API ─────────────────────────
  let tenDriveBase: string | null = null;
  let tenItemId: string | null = null;

  const searchRes = await fetch("https://graph.microsoft.com/v1.0/search/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ entityTypes: ["driveItem"], query: { queryString: "TEN" }, fields: ["name", "id", "parentReference"], from: 0, size: 25 }],
    }),
  });
  if (searchRes.ok) {
    const sd = await searchRes.json();
    const hits = sd?.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
    const tenHit = hits.find((h: { resource: { name: string; parentReference?: { driveId?: string } }; hitId: string }) =>
      h.resource?.name?.toLowerCase() === "ten"
    );
    if (tenHit) {
      const driveId = tenHit.resource.parentReference?.driveId;
      if (driveId) {
        tenDriveBase = `https://graph.microsoft.com/v1.0/drives/${driveId}`;
        tenItemId = tenHit.hitId;
      }
    }
  }

  // ── 3. TEN drive quota (Adonis's drive) ──────────────────────
  let tenDriveInfo = null;
  if (tenDriveBase) {
    const driveId = tenDriveBase.split("/drives/")[1];
    tenDriveInfo = await graphGet(token, `https://graph.microsoft.com/v1.0/drives/${driveId}?$select=quota,name,driveType`);
  }

  // ── 4. TEN/Events folder breakdown ───────────────────────────
  const currentYear = new Date().getFullYear().toString();
  let eventFolders: Array<{ name: string; year: string; size: number; fileCount: number; formattedSize: string }> = [];

  if (tenDriveBase && tenItemId) {
    // Get years
    const yearsRes = await graphGet(token, `${tenDriveBase}/items/${tenItemId}:/Events:/children?$select=name,id,folder,size&$top=20`);
    const years: DriveItemRaw[] = (yearsRes?.value ?? []).filter((i: DriveItemRaw) => i.folder);

    // Focus on current year
    const thisYear = years.find((y) => y.name === currentYear);
    if (thisYear) {
      const eventsRes = await graphGet(
        token,
        `${tenDriveBase}/items/${thisYear.id}/children?$select=name,id,folder,size&$top=50`
      );
      const events: DriveItemRaw[] = (eventsRes?.value ?? []).filter((i: DriveItemRaw) => i.folder);
      // Get each event's size + child count in parallel (shallow — just the folder metadata)
      const eventDetails = await Promise.all(
        events.map(async (ev) => {
          const info = await graphGet(token, `${tenDriveBase}/items/${ev.id}?$select=name,size,folder`);
          return {
            name: ev.name,
            year: currentYear,
            size: info?.size ?? ev.size ?? 0,
            fileCount: info?.folder?.childCount ?? 0,
            formattedSize: formatBytes(info?.size ?? ev.size ?? 0),
          };
        })
      );
      eventFolders = eventDetails.sort((a, b) => b.size - a.size);
    }
  }

  // ── 5. Top-level folders on personal drive ────────────────────
  const rootChildren = await graphGet(
    token,
    "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=name,id,folder,size,file&$top=50"
  );
  const topFolders = ((rootChildren?.value ?? []) as DriveItemRaw[])
    .filter((i) => i.folder)
    .map((i) => ({ name: i.name, size: i.size ?? 0, childCount: i.folder?.childCount ?? 0, formattedSize: formatBytes(i.size ?? 0) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  // ── 6. File type search on TEN drive ─────────────────────────
  const fileTypes: Record<string, { count: number; bytes: number }> = {};
  if (tenDriveBase && tenItemId) {
    for (const ext of [".pptx", ".pdf", ".docx", ".xlsx", ".jpg", ".png", ".mp4"]) {
      const res = await fetch("https://graph.microsoft.com/v1.0/search/query", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ entityTypes: ["driveItem"], query: { queryString: ext }, fields: ["name", "size"], from: 0, size: 100 }],
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const hits = data?.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
        const matching = hits.filter((h: { resource: { name: string; size?: number } }) =>
          h.resource?.name?.toLowerCase().endsWith(ext)
        );
        if (matching.length > 0) {
          fileTypes[ext] = {
            count: matching.length,
            bytes: matching.reduce((s: number, h: { resource: { size?: number } }) => s + (h.resource?.size ?? 0), 0),
          };
        }
      }
    }
  }

  const fileTypeBreakdown = Object.entries(fileTypes)
    .map(([ext, { count, bytes }]) => ({ ext, count, bytes, formattedSize: formatBytes(bytes) }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    personalQuota: quota
      ? {
          used: quota.used ?? 0,
          remaining: quota.remaining ?? 0,
          total: quota.total ?? 0,
          usedFormatted: formatBytes(quota.used ?? 0),
          remainingFormatted: formatBytes(quota.remaining ?? 0),
          totalFormatted: formatBytes(quota.total ?? 0),
          usedPercent: quota.total ? Math.round((quota.used / quota.total) * 100) : 0,
        }
      : null,
    tenDrive: tenDriveInfo
      ? {
          name: tenDriveInfo.name,
          driveType: tenDriveInfo.driveType,
          quota: tenDriveInfo.quota
            ? {
                used: tenDriveInfo.quota.used ?? 0,
                remaining: tenDriveInfo.quota.remaining ?? 0,
                total: tenDriveInfo.quota.total ?? 0,
                usedFormatted: formatBytes(tenDriveInfo.quota.used ?? 0),
                remainingFormatted: formatBytes(tenDriveInfo.quota.remaining ?? 0),
                totalFormatted: formatBytes(tenDriveInfo.quota.total ?? 0),
                usedPercent: tenDriveInfo.quota.total
                  ? Math.round((tenDriveInfo.quota.used / tenDriveInfo.quota.total) * 100)
                  : 0,
              }
            : null,
        }
      : null,
    eventFolders,
    topPersonalFolders: topFolders,
    fileTypeBreakdown,
    year: currentYear,
  };
}

// ── Route handler ─────────────────────────────────────────────
export async function GET() {
  const { token, error } = await getToken();
  if (!token) {
    return NextResponse.json({ error: error ?? "not authenticated" }, { status: 401 });
  }

  const data = await fetchAnalyticsData(token);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" },
  });
}
