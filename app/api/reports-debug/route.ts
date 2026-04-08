import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const results: Record<string, unknown> = {};

  // 1. Check session
  results.session = {
    hasSession: !!session,
    hasAccessToken: !!session?.accessToken,
    user: session?.user?.email ?? null,
  };

  // 2. Try Graph with session token
  if (session?.accessToken) {
    try {
      const r = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive/root:/TEN/Events:/children?$select=name,folder&$top=10",
        { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
      );
      const body = await r.json();
      results.graphDelegated = { status: r.status, value: body?.value?.map((i: {name:string}) => i.name) ?? body };
    } catch (e) {
      results.graphDelegated = { error: String(e) };
    }
  }

  // 3. Check env vars (masked)
  results.envVars = {
    AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
    ONEDRIVE_USER_EMAIL: process.env.ONEDRIVE_USER_EMAIL ?? "NOT SET",
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
  };

  // 4. Try app-creds token
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
    try {
      const tr = await fetch(
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
      const td = await tr.json();
      results.appToken = { obtained: !!td.access_token, error: td.error ?? null };

      if (td.access_token && process.env.ONEDRIVE_USER_EMAIL) {
        const userId = encodeURIComponent(process.env.ONEDRIVE_USER_EMAIL);
        const fr = await fetch(
          `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:/TEN/Events:/children?$select=name,folder&$top=10`,
          { headers: { Authorization: `Bearer ${td.access_token}` }, cache: "no-store" }
        );
        const fb = await fr.json();
        results.graphAppCreds = { status: fr.status, value: fb?.value?.map((i: {name:string}) => i.name) ?? fb };
      }
    } catch (e) {
      results.appToken = { error: String(e) };
    }
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
