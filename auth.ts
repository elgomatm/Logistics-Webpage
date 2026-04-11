import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateId, randomAvatarColor } from "@/lib/utils";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Force the callback URL to always use the stable production domain.
  // Without this, Vercel uses the per-deployment preview URL which doesn't
  // match what's registered in Azure, causing AADSTS50011.
  trustHost: true,

  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID ?? "common"}/v2.0`,
      authorization: {
        params: {
          scope:
            "openid profile email offline_access https://graph.microsoft.com/Files.Read.All",
        },
      },
    }),
  ],

  debug: process.env.NODE_ENV === "development",

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
      }
      if (account?.refresh_token) {
        token.refreshToken = account.refresh_token;
      }

      // On sign-in, sync user to database and capture role + dbId
      if (account && profile?.email) {
        try {
          const email = profile.email.toLowerCase();
          const [existing] = await db
            .select({ id: users.id, role: users.role, avatarColor: users.avatarColor, active: users.active })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existing) {
            token.dbUserId = existing.id;
            token.role = existing.role;
            token.avatarColor = existing.avatarColor;
          } else {
            const id = generateId();
            const isFirstUser = (await db.select({ id: users.id }).from(users).limit(1)).length === 0;
            await db.insert(users).values({
              id,
              name: profile.name ?? email.split("@")[0],
              email,
              emailVerified: new Date(),
              image: (profile as Record<string, unknown>).picture as string | undefined ?? null,
              role: isFirstUser ? "admin" : "viewer",
              avatarColor: randomAvatarColor(),
            });
            token.dbUserId = id;
            token.role = isFirstUser ? "admin" : "viewer";
            token.avatarColor = randomAvatarColor();
          }
        } catch (err) {
          console.error("[AUTH] JWT callback DB error:", err);
          // Still return the token so sign-in doesn't completely fail
          token.dbUserId = "unknown";
          token.role = "viewer";
          token.avatarColor = "#3b82f6";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
      if (token.dbUserId) {
        session.user.id = token.dbUserId as string;
        session.user.role = token.role as string;
        session.user.avatarColor = token.avatarColor as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});
