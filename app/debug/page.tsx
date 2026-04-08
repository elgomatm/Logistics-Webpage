/**
 * /debug  — live diagnostic page
 * Shows every step of the OneDrive connection in the browser.
 * Only accessible when signed in. Delete this route before going fully public.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";

type StepResult = {
  label: string;
  status: "ok" | "fail" | "skip";
  detail: string;
};

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function runDiagnostics(token: string): Promise<StepResult[]> {
  const steps: StepResult[] = [];

  // Step 1: sharedWithMe
  const shared = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$select=name,id,remoteItem&$top=200");
  const sharedItems: Array<{ name: string; id: string; remoteItem?: { id: string; parentReference?: { driveId?: string }; driveId?: string } }> = shared.data?.value ?? [];
  steps.push({
    label: "1. sharedWithMe — all items",
    status: sharedItems.length > 0 ? "ok" : "fail",
    detail: sharedItems.length > 0
      ? `ℹ️ ${sharedItems.length} item(s): ${sharedItems.map((i) => i.name).join(", ")}`
      : `❌ No shared items returned (HTTP ${shared.status})`,
  });

  // Step 2: list all drives
  const drivesRes = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drives?$select=id,name,driveType,webUrl");
  const drives: Array<{ id: string; name: string; driveType: string; webUrl?: string }> = drivesRes.data?.value ?? [];
  steps.push({
    label: "2. All accessible drives",
    status: drives.length > 0 ? "ok" : "fail",
    detail: drives.length > 0
      ? `✅ ${drives.length} drive(s):\n${drives.map((d) => `  • ${d.name} [${d.driveType}] id:${d.id}`).join("\n")}`
      : `❌ No drives returned (HTTP ${drivesRes.status})`,
  });

  // Step 3: check root of each drive for TEN or Events folder
  let foundDriveId: string | null = null;
  let foundItemId: string | null = null;
  let foundDriveName: string | null = null;

  for (const drive of drives) {
    const root = await graphGet(token, `https://graph.microsoft.com/v1.0/drives/${drive.id}/root/children?$select=name,id,folder&$top=200`);
    const items: Array<{ name: string; id: string; folder?: unknown }> = root.data?.value ?? [];
    const tenFolder = items.find((i) => i.name.toLowerCase() === "ten");
    const eventsFolder = items.find((i) => i.name.toLowerCase() === "events");
    steps.push({
      label: `3. Root of drive: ${drive.name}`,
      status: (tenFolder || eventsFolder) ? "ok" : "skip",
      detail: items.length > 0
        ? `${tenFolder ? "✅ TEN folder found!" : eventsFolder ? "✅ Events folder found!" : "ℹ️ No TEN/Events"} — folders: ${items.filter((i) => i.folder).map((i) => i.name).join(", ") || "none"}`
        : `❌ HTTP ${root.status} — empty or error`,
    });
    if (tenFolder && !foundDriveId) {
      foundDriveId = drive.id;
      foundItemId = tenFolder.id;
      foundDriveName = drive.name;
    }
  }

  // Step 4: followed SharePoint sites
  const sitesRes = await graphGet(token, "https://graph.microsoft.com/v1.0/me/followedSites?$select=id,name,webUrl");
  const sites: Array<{ id: string; name: string; webUrl: string }> = sitesRes.data?.value ?? [];
  steps.push({
    label: "4. Followed SharePoint sites",
    status: sites.length > 0 ? "ok" : "skip",
    detail: sites.length > 0
      ? `✅ ${sites.length} site(s): ${sites.map((s) => s.name).join(", ")}`
      : `ℹ️ No followed sites (HTTP ${sitesRes.status})`,
  });

  // Step 5: search for TEN across all drives
  const searchRes = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drive/root/search(q='TEN')?$select=name,id,folder,parentReference&$top=25");
  const searchItems: Array<{ name: string; id: string; folder?: unknown; parentReference?: { path: string; driveId: string } }> = (searchRes.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
  steps.push({
    label: "5. Search for 'TEN' folder across drives",
    status: searchItems.length > 0 ? "ok" : "fail",
    detail: searchItems.length > 0
      ? `✅ Found: ${searchItems.map((i) => `${i.name} (driveId:${i.parentReference?.driveId}, path:${i.parentReference?.path})`).join("\n")}`
      : `❌ No TEN folder found via search (HTTP ${searchRes.status})`,
  });

  // Step 6: if we found TEN on a drive, navigate into it
  if (foundDriveId && foundItemId) {
    const driveBase = `https://graph.microsoft.com/v1.0/drives/${foundDriveId}`;
    const eventsRes = await graphGet(token, `${driveBase}/items/${foundItemId}:/Events:/children?$select=name,id,folder&$top=100`);
    const yearFolders: Array<{ name: string; id: string }> = (eventsRes.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
    steps.push({
      label: `6. TEN/Events/ on drive "${foundDriveName}"`,
      status: yearFolders.length > 0 ? "ok" : "fail",
      detail: yearFolders.length > 0
        ? `✅ Year folders: ${yearFolders.map((y) => y.name).join(", ")}`
        : `❌ HTTP ${eventsRes.status}: ${JSON.stringify(eventsRes.data).slice(0, 200)}`,
    });
  }

  return steps;
}

export default async function DebugPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Use session token first — it reflects the scopes from the most recent sign-in.
  // Fall back to stored refresh token only if no session token is available.
  let token: string | null = null;
  let tokenSource = "none";

  if (session.accessToken) { token = session.accessToken; tokenSource = "session"; }

  if (!token) {
    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, ONEDRIVE_REFRESH_TOKEN } = process.env;
    if (ONEDRIVE_REFRESH_TOKEN && AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
      const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: AZURE_CLIENT_ID, client_secret: AZURE_CLIENT_SECRET,
          grant_type: "refresh_token", refresh_token: ONEDRIVE_REFRESH_TOKEN,
          scope: "https://graph.microsoft.com/Files.Read.All offline_access",
        }),
        cache: "no-store",
      });
      const data = await res.json();
      if (data.access_token) { token = data.access_token; tokenSource = "refresh_token (stored)"; }
    }
  }

  const steps = token ? await runDiagnostics(token) : [];

  return (
    <div style={{ fontFamily: "monospace", padding: "40px", maxWidth: 860, margin: "0 auto", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#fff" }}>TEN OneDrive Diagnostics</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>
        Token source: <strong style={{ color: "#c9a96e" }}>{tokenSource}</strong>
        {" · "}Signed in as: <strong style={{ color: "#c9a96e" }}>{session.user?.email}</strong>
      </p>

      {!token && (
        <div style={{ background: "#3a0000", border: "1px solid #ff4444", borderRadius: 8, padding: 16, color: "#ff8888" }}>
          ❌ No token available — make sure ONEDRIVE_REFRESH_TOKEN is set in Vercel, or sign in first.
        </div>
      )}

      {steps.map((step, i) => (
        <div key={i} style={{
          background: step.status === "ok" ? "#0d1f0d" : step.status === "fail" ? "#1f0d0d" : "#111",
          border: `1px solid ${step.status === "ok" ? "#2a4a2a" : step.status === "fail" ? "#4a2a2a" : "#333"}`,
          borderRadius: 8, padding: "14px 18px", marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ccc", marginBottom: 6 }}>{step.label}</div>
          <div style={{ fontSize: 12, color: step.status === "ok" ? "#6fcf6f" : step.status === "fail" ? "#cf6f6f" : "#aaa", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {step.detail}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: "#555", marginTop: 32 }}>
        Refresh this page to re-run diagnostics. Results are not cached.
      </p>
    </div>
  );
}
