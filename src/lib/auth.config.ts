import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const token = auth;

      const isPublicPath =
        pathname === "/" ||
        pathname === "/auth/login" ||
        pathname === "/auth/register" ||
        pathname.startsWith("/api/stripe/webhook") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon");

      if (!token && !isPublicPath) {
        return Response.redirect(new URL("/auth/login", nextUrl));
      }

      if (
        token &&
        (pathname === "/auth/login" || pathname === "/auth/register")
      ) {
        const status = (token as { status?: string }).status;
        if (status === "PENDING") {
          return Response.redirect(new URL("/onboarding", nextUrl));
        }
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (
        token &&
        (token as { status?: string }).status === "PENDING" &&
        pathname !== "/onboarding" &&
        !pathname.startsWith("/api") &&
        !isPublicPath
      ) {
        return Response.redirect(new URL("/onboarding", nextUrl));
      }

      if (
        pathname.startsWith("/admin") &&
        (token as { role?: string })?.role !== "ADMIN"
      ) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.status = (user as { status?: string }).status;
        token.schoolId = (user as { schoolId?: string | null }).schoolId;
        token.schoolName = (user as { schoolName?: string | null }).schoolName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.schoolId = token.schoolId as string | null;
        session.user.schoolName = token.schoolName as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
};
