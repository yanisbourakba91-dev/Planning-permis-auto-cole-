import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const studentSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  drivingHours: z.number().min(0).default(0),
  lastDrivingDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const students = await prisma.student.findMany({
    where: {
      schoolId: session.user.schoolId,
      OR: search
        ? [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      placements: {
        orderBy: { date: "desc" },
        take: 1,
      },
      _count: { select: { placements: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = studentSchema.parse(body);

    const student = await prisma.student.create({
      data: {
        ...data,
        email: data.email || null,
        lastDrivingDate: data.lastDrivingDate ? new Date(data.lastDrivingDate) : null,
        schoolId: session.user.schoolId,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Create student error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
