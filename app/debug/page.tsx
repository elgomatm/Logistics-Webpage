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

async function graphPost(token: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function runDiagnostics(token: string): Promise<StepResult[]> {
  const steps: StepResult[] = [];

  // Step 1: Microsoft Search API — searches ALL content the user can access
  // including shared OneDrive folders that sharedWithMe misses
  const searchRes = await graphPost(token, "https://graph.microsoft.com/v1.0/search/query", {
    requests: [{
      entityTypes: ["driveItem"],
      query: { queryString: "TEN" },
      fields: ["name", "id", "parentReference", "webUrl"],
      from: 0, size: 25,
    }],
  });
  const hits: Array<{ hitId: string; resource: { name: string; id: string; parentReference?: { driveId: string; path: string }; webUrl?: string } }> =
    searchRes.data?.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
  const tenHits = hits.filter((h) => h.resource?.name?.toLowerCase() === "ten");
  steps.push({
    label: "1. Microsoft Search — find TEN folder",
    status: tenHits.length > 0 ? "ok" : "fail",
    detail: tenHits.length > 0
      ? `✅ Found TEN!\n${tenHits.map((h) => `  driveId: ${h.resource.parentReference?.driveId}\n  itemId: ${h.hitId}\n  path: ${h.resource.parentReference?.path}`).join("\n")}`
      : `❌ TEN not found via search (HTTP ${searchRes.status}). All hits: ${hits.map((h) => h.resource?.name).join(", ") || "none"}`,
  });

  // Step 2: if found, navigate TEN → Events → 2026
  if (tenHits.length > 0) {
    const tenHit = tenHits[0];
    const driveId = tenHit.resource.parentReference?.driveId;
    const itemId = tenHit.hitId;

    if (driveId && itemId) {
      const driveBase = `https://graph.microsoft.com/v1.0/drives/${driveId}`;

      const eventsRes = await graphGet(token, `${driveBase}/items/${itemId}:/Events:/children?$select=name,id,folder&$top=100`);
      const yearFolders: Array<{ name: string; id: string }> = (eventsRes.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
      steps.push({
        label: "2. TEN/Events/ — year folders",
        status: yearFolders.length > 0 ? "ok" : "fail",
        detail: yearFolders.length > 0
          ? `✅ ${yearFolders.map((y) => y.name).join(", ")}`
          : `❌ HTTP ${eventsRes.status}: ${JSON.stringify(eventsRes.data).slice(0, 300)}`,
      });

      // Step 3: event folders for current year
      const currentYear = new Date().getFullYear().toString();
      const yearFolder = yearFolders.find((y) => y.name === currentYear);
      if (yearFolder) {
        const evts = await graphGet(token, `${driveBase}/items/${yearFolder.id}/children?$select=name,id,folder&$top=100`);
        const eventFolders: Array<{ name: string; id: string }> = (evts.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
        steps.push({
          label: `3. TEN/Events/${currentYear}/ — event folders`,
          status: eventFolders.length > 0 ? "ok" : "fail",
          detail: eventFolders.length > 0
            ? `✅ ${eventFolders.length} events: ${eventFolders.map((e) => e.name).join(", ")}`
            : `❌ No event folders (HTTP ${evts.status})`,
        });

        // Step 4: sample — reports in first event
        if (eventFolders.length > 0) {
          const first = eventFolders[0];
          const rpts = await graphGet(token, `${driveBase}/items/${first.id}:/Documents/Reports:/children?$select=name,id,file&$top=25`);
          const files: Array<{ name: string }> = (rpts.data?.value ?? []).filter((i: { file?: unknown }) => i.file);
          steps.push({
            label: `4. Sample reports in "${first.name}"`,
            status: rpts.ok ? "ok" : "fail",
            detail: rpts.ok
              ? `✅ ${files.length} file(s): ${files.slice(0, 5).map((f) => f.name).join(", ")}${files.length > 5 ? "…" : ""}`
              : `❌ HTTP ${rpts.status}: ${JSON.stringify(rpts.data).slice(0, 200)}`,
          });
        }
      }
    }
  }

  // Always show sharedWithMe for reference
  const shared = await graphGet(token, "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$select=name,id&$top=50");
  const sharedItems: Array<{ name: string }> = shared.data?.value ?? [];
  steps.push({
    label: "ℹ️ sharedWithMe (for reference)",
    status: "skip",
    detail: `${sharedItems.length} item(s): ${sharedItems.map((i) => i.name).join(", ") || "none"}`,
  });

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
