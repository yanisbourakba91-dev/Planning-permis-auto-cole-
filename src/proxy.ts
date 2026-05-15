import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === "/" ||
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  // Si NEXTAUTH_SECRET absent → laisser passer, les pages se protègent elles-mêmes
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.next();
  }

  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch {
    // En cas d'erreur JWT → traiter comme non-authentifié
    if (!isPublicPath) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.next();
  }

  // Non authentifié → rediriger vers login sauf routes publiques
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Authentifié sur login/register → rediriger selon statut
  if (token && (pathname === "/auth/login" || pathname === "/auth/register")) {
    if (token.status === "PENDING") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Compte en attente → forcer l'onboarding
  if (
    token &&
    token.status === "PENDING" &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api") &&
    !isPublicPath
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Routes admin réservées à l'admin
  if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
