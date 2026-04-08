import { auth } from "@/auth";

// NextAuth v5 middleware — redirects unauthenticated users to /login
export default auth;

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - /login        (the login page itself)
     *  - /api/auth/**  (NextAuth callback routes)
     *  - /_next/**     (Next.js internals)
     *  - /ten-logo.png (public assets)
     *  - /favicon.ico
     */
    "/((?!login|api/auth|_next/static|_next/image|ten-logo.png|favicon.ico).*)",
  ],
};
