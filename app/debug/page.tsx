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
  const tenItem = sharedItems.find((i: { name: string }) => i.name.toLowerCase() === "ten");

  steps.push({
    label: "1. sharedWithMe — find TEN folder",
    status: tenItem ? "ok" : "fail",
    detail: tenItem
      ? `✅ Found TEN — remoteItem driveId: ${tenItem.remoteItem?.parentReference?.driveId ?? tenItem.remoteItem?.driveId ?? "none"}, itemId: ${tenItem.remoteItem?.id ?? "none"}`
      : `❌ TEN not found. Items returned (${sharedItems.length}): ${sharedItems.map((i: { name: string }) => i.name).join(", ") || "none"}`,
  });

  if (!tenItem?.remoteItem) return steps;

  const driveId = tenItem.remoteItem.parentReference?.driveId ?? tenItem.remoteItem.driveId;
  const itemId = tenItem.remoteItem.id;
  if (!driveId || !itemId) {
    steps.push({ label: "2. Resolve TEN remote reference", status: "fail", detail: "❌ remoteItem missing driveId or id" });
    return steps;
  }
  steps.push({ label: "2. Resolve TEN remote reference", status: "ok", detail: `✅ driveId: ${driveId}` });

  const driveBase = `https://graph.microsoft.com/v1.0/drives/${driveId}`;

  // Step 3: list TEN root
  const tenRoot = await graphGet(token, `${driveBase}/items/${itemId}/children?$select=name,id,folder&$top=100`);
  const tenChildren: Array<{ name: string; folder?: unknown }> = tenRoot.data?.value ?? [];
  steps.push({
    label: "3. TEN root contents",
    status: tenRoot.ok ? "ok" : "fail",
    detail: tenRoot.ok
      ? `✅ ${tenChildren.map((c: { name: string; folder?: unknown }) => `${c.name}${c.folder ? "/" : ""}`).join("  ")}`
      : `❌ HTTP ${tenRoot.status}: ${JSON.stringify(tenRoot.data).slice(0, 200)}`,
  });

  // Step 4: find Events folder
  const eventsFolder = tenChildren.find((c: { name: string }) => c.name.toLowerCase() === "events");
  if (!eventsFolder) {
    steps.push({ label: "4. Events folder", status: "fail", detail: "❌ No 'Events' folder found inside TEN" });
    return steps;
  }
  steps.push({ label: "4. Events folder", status: "ok", detail: "✅ Found Events/" });

  // Step 5: list years
  const eventsFolderItem = tenChildren.find((c: { name: string; id?: string }) => c.name.toLowerCase() === "events") as { name: string; id: string } | undefined;
  if (!eventsFolderItem?.id) return steps;

  const years = await graphGet(token, `${driveBase}/items/${eventsFolderItem.id}/children?$select=name,id,folder&$top=100`);
  const yearFolders: Array<{ name: string; id: string; folder?: unknown }> = (years.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
  steps.push({
    label: "5. Year folders in Events/",
    status: yearFolders.length > 0 ? "ok" : "fail",
    detail: yearFolders.length > 0
      ? `✅ ${yearFolders.map((y: { name: string }) => y.name).join(", ")}`
      : "❌ No year folders found",
  });

  // Step 6: list event folders for current year
  const currentYear = new Date().getFullYear().toString();
  const yearFolder = yearFolders.find((y: { name: string }) => y.name === currentYear);
  if (!yearFolder) {
    steps.push({ label: `6. ${currentYear} folder`, status: "fail", detail: `❌ No ${currentYear} folder found` });
    return steps;
  }

  const events = await graphGet(token, `${driveBase}/items/${yearFolder.id}/children?$select=name,id,folder&$top=100`);
  const eventFolders: Array<{ name: string }> = (events.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder);
  steps.push({
    label: `6. Event folders in ${currentYear}/`,
    status: eventFolders.length > 0 ? "ok" : "fail",
    detail: eventFolders.length > 0
      ? `✅ ${eventFolders.length} events: ${eventFolders.map((e: { name: string }) => e.name).join(", ")}`
      : "❌ No event folders found",
  });

  // Step 7: count reports in first event as a sanity check
  if (eventFolders.length > 0) {
    const firstEventFolders = (events.data?.value ?? []).filter((i: { folder?: unknown }) => i.folder) as Array<{ name: string; id: string }>;
    const firstEvent = firstEventFolders[0];
    const reports = await graphGet(token, `${driveBase}/items/${firstEvent.id}:/Documents/Reports:/children?$select=name,id,file&$top=100`);
    const reportFiles: Array<{ name: string; file?: unknown }> = (reports.data?.value ?? []).filter((i: { file?: unknown }) => i.file);
    steps.push({
      label: `7. Sample — Reports in "${firstEvent.name}"`,
      status: reports.ok ? "ok" : "fail",
      detail: reports.ok
        ? `✅ ${reportFiles.length} files: ${reportFiles.slice(0, 5).map((f: { name: string }) => f.name).join(", ")}${reportFiles.length > 5 ? "…" : ""}`
        : `❌ HTTP ${reports.status} — ${JSON.stringify(reports.data).slice(0, 200)}`,
    });
  }

  return steps;
}

export default async function DebugPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Try refresh token first, fall back to session
  let token: string | null = null;
  let tokenSource = "none";

  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, ONEDRIVE_REFRESH_TOKEN } = process.env;
  if (ONEDRIVE_REFRESH_TOKEN && AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
    const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID, client_secret: AZURE_CLIENT_SECRET,
        grant_type: "refresh_token", refresh_token: ONEDRIVE_REFRESH_TOKEN,
        scope: "https://graph.microsoft.com/Files.Read offline_access",
      }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.access_token) { token = data.access_token; tokenSource = "refresh_token"; }
  }
  if (!token && session.accessToken) { token = session.accessToken; tokenSource = "session"; }

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
