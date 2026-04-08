import { auth } from "@/auth";

export default auth;

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|ten-logo.png|favicon.ico).*)",
  ],
};
