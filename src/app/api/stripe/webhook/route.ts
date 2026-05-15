import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      return NextResponse.json({ error: "userId manquant" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: session.customer as string,
        stripeSessionId: session.id,
        status: "active",
      },
      update: {
        stripeCustomerId: session.customer as string,
        status: "active",
      },
    });
  }

  return NextResponse.json({ received: true });
}
