import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const publicRoutes = ["/", "/auth/login", "/auth/register"];
  const isPublic = publicRoutes.some((r) => pathname === r || pathname.startsWith("/api/stripe/webhook") || pathname.startsWith("/api/auth"));

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  if (session && (pathname === "/auth/login" || pathname === "/auth/register")) {
    if (session.user.status === "PENDING") {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (session && session.user.status === "PENDING" && pathname !== "/onboarding" && !pathname.startsWith("/api") && !isPublic) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  if (pathname.startsWith("/admin") && session?.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
