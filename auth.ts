import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      tenantId: process.env.AZURE_TENANT_ID ?? "common",
      authorization: {
        params: {
          // Requests an offline_access (refresh token) plus Files.Read
          // so the app can poll OneDrive without re-prompting the user.
          scope:
            "openid profile email offline_access https://graph.microsoft.com/Files.Read",
        },
      },
    }),
  ],

  callbacks: {
    // Persist the Microsoft access token inside the JWT so API routes can use it
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    // Expose the access token on the session object available to client components
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },

  pages: {
    signIn: "/login", // redirect here when unauthenticated
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — "remember me"
  },
});
