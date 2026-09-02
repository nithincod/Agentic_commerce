import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";

import prisma from "@/lib/db/prisma";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    GitHub({
      clientId:
        process.env.AUTH_GITHUB_ID,

      clientSecret:
        process.env.AUTH_GITHUB_SECRET,
    }),
  ],

  session: {
    strategy: "database",
  },

  callbacks: {
    async session({
      session,
      user,
    }) {
      if (!session.user) {
        return session;
      }

      /*
       * Always read authorization information from
       * PostgreSQL rather than trusting client state.
       */
      const dbUser =
        await prisma.user.findUnique({
          where: {
            id: user.id,
          },

          include: {
            merchant: true,
          },
        });

      if (!dbUser) {
        return session;
      }

      session.user.id =
        dbUser.id;

      session.user.role =
        dbUser.role;

      session.user.merchantId =
        dbUser.merchant?.id ||
        null;

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});