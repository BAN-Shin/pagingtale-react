import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

type RouteContext = {
  params: Promise<{
    bookId: string;
  }>;
};

function normalizeMode(value: unknown): "practice" | "test" | null {
  const mode = String(value ?? "").trim().toLowerCase();

  if (mode === "practice") return "practice";
  if (mode === "test") return "test";
  return null;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAdminSession();

    if (!session || (session.role !== "teacher" && session.role !== "admin")) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { bookId } = await context.params;
    const body = await req.json();
    const nextMode = normalizeMode(body?.mode);

    if (!bookId.trim()) {
      return NextResponse.json(
        { ok: false, message: "bookId is required." },
        { status: 400 }
      );
    }

    if (!nextMode) {
      return NextResponse.json(
        { ok: false, message: "mode must be practice or test." },
        { status: 400 }
      );
    }

    const found = await db.query.books.findFirst({
      where: eq(books.bookId, bookId),
    });

    if (!found) {
      return NextResponse.json(
        { ok: false, message: "Book not found." },
        { status: 404 }
      );
    }

    if (session.role !== "admin" && found.ownerTeacherId !== session.teacherId) {
      return NextResponse.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await db
      .update(books)
      .set({
        mode: nextMode,
        updatedAt: new Date(),
      })
      .where(and(eq(books.bookId, bookId)));

    return NextResponse.json({
      ok: true,
      bookId,
      mode: nextMode,
    });
  } catch (error) {
    console.error("[PATCH /api/teacher/books/[bookId]/mode]", error);

    return NextResponse.json(
      { ok: false, message: "Failed to update book mode." },
      { status: 500 }
    );
  }
}