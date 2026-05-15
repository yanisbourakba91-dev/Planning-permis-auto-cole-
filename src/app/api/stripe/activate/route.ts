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

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId manquant" }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      checkoutSession.payment_status === "paid" ||
      checkoutSession.status === "complete"
    ) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { status: "ACTIVE" },
      });

      await prisma.subscription.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          stripeCustomerId: checkoutSession.customer as string,
          stripeSessionId: checkoutSession.id,
          status: "active",
        },
        update: {
          stripeCustomerId: checkoutSession.customer as string,
          status: "active",
        },
      });

      return NextResponse.json({ activated: true });
    }

    return NextResponse.json({ activated: false });
  } catch (error) {
    console.error("Stripe activate error:", error);
    return NextResponse.json({ error: "Erreur lors de l'activation" }, { status: 500 });
  }
}
