import { NextRequest, NextResponse } from "next/server";

// Lazily import auth so a missing AUTH_SECRET during `next build`
// doesn't crash the build — it only throws at actual request time.
export async function middleware(req: NextRequest) {
  // If AUTH_SECRET isn't configured yet, skip auth enforcement
  // (so `npm run build` / Vercel build passes without env vars).
  if (!process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  const { auth } = await import("@/auth");
  return auth(req as Parameters<typeof auth>[0]);
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - /login        (the login page itself)
     *  - /api/auth/**  (NextAuth callback routes)
     *  - /_next/**     (Next.js internals)
     *  - static assets (ten-logo.png, favicon.ico)
     */
    "/((?!login|api/auth|_next/static|_next/image|ten-logo.png|favicon.ico).*)",
  ],
};
