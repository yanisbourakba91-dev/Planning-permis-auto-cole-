import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ key: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { key } = schema.parse(body);

    const accessKey = await prisma.accessKey.findUnique({
      where: { key },
    });

    if (!accessKey) {
      return NextResponse.json({ error: "Clé d'accès invalide" }, { status: 400 });
    }

    if (accessKey.used) {
      return NextResponse.json({ error: "Cette clé a déjà été utilisée" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.accessKey.update({
        where: { id: accessKey.id },
        data: { used: true, usedById: session.user.id, usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { status: "ACTIVE" },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
    }
    console.error("Activate key error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
