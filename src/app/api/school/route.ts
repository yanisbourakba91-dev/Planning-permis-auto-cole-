import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    include: {
      _count: { select: { students: true, placements: true } },
    },
  });

  return NextResponse.json(school);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const schema = z.object({
      name: z.string().min(1).optional(),
      address: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    });
    const data = schema.parse(body);

    const school = await prisma.school.update({
      where: { id: session.user.schoolId },
      data,
    });

    return NextResponse.json(school);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
