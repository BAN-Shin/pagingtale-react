import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { books, teachers } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: books.id,
        bookId: books.bookId,
        title: books.title,
        ownerTeacherId: books.ownerTeacherId,
        mode: books.mode,
        isPublished: books.isPublished,
        pageCount: books.pageCount,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        ownerTeacherName: teachers.teacherName,
      })
      .from(books)
      .leftJoin(teachers, eq(books.ownerTeacherId, teachers.id))
      .where(inArray(books.mode, ["practice", "test"]))
      .orderBy(asc(books.bookId));

    return NextResponse.json({
      ok: true,
      books: rows,
    });
  } catch (error) {
    console.error("[GET /api/books]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to load public books.",
      },
      { status: 500 }
    );
  }
}