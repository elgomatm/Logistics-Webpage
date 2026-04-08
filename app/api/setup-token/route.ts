/**
 * /api/setup-token
 *
 * One-time setup endpoint. Visit this while signed in with the Microsoft account
 * that owns the TEN OneDrive folder. It will display your refresh token so you
 * can paste it into Vercel as ONEDRIVE_REFRESH_TOKEN.
 *
 * After you've saved the token to Vercel, this endpoint is no longer needed
 * (but it's safe to leave — it only works if you're already signed in).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Not signed in. Please sign in first, then visit this page." },
      { status: 401 }
    );
  }

  if (!session.refreshToken) {
    return NextResponse.json({
      error: "No refresh token found in session.",
      hint: "Try signing out and signing back in — Microsoft only returns a refresh token on fresh logins.",
      user: session.user.email,
    });
  }

  // Test that the refresh token actually works by using it to get a fresh access token
  const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID } = process.env;
  let tokenTest: { works: boolean; error?: string } = { works: false };

  if (AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && AZURE_TENANT_ID) {
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
            refresh_token: session.refreshToken,
            scope: "https://graph.microsoft.com/Files.Read offline_access",
          }),
          cache: "no-store",
        }
      );
      const data = await res.json();
      tokenTest = data.access_token
        ? { works: true }
        : { works: false, error: data.error_description ?? data.error };
    } catch (e) {
      tokenTest = { works: false, error: String(e) };
    }
  }

  return NextResponse.json({
    success: true,
    user: session.user.email,
    instructions: [
      "1. Copy the refresh_token value below",
      "2. Go to Vercel → your project → Settings → Environment Variables",
      "3. Add a new variable: ONEDRIVE_REFRESH_TOKEN = <paste token here>",
      "4. Redeploy the project",
      "5. The app will now read OneDrive 24/7 without needing you to be signed in",
    ],
    tokenTest,
    // The token itself — copy this into Vercel
    refresh_token: session.refreshToken,
  });
}
