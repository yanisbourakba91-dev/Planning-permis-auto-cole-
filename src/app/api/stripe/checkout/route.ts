import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const appUrl = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL ?? "https://planning-permis-auto-cole.vercel.app");
    console.log("Stripe checkout appUrl:", appUrl);

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/onboarding?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/onboarding?canceled=true`,
      metadata: {
        userId: session.user.id,
      },
      customer_email: session.user.email,
    });

    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        stripeSessionId: stripeSession.id,
        status: "pending",
      },
      update: {
        stripeSessionId: stripeSession.id,
        status: "pending",
      },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Erreur lors de la création de la session Stripe" }, { status: 500 });
  }
}
