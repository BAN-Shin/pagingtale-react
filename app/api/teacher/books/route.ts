import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, teachers } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePageCount(value: unknown): number {
  const num = Number(value ?? 0);

  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }

  return Math.floor(num);
}

function normalizeOwnerTeacherId(value: unknown): number | null {
  const num = Number(value ?? 0);

  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }

  return num;
}

export async function GET() {
  try {
    const session = await getAdminSession();

    if (!session || (session.role !== "teacher" && session.role !== "admin")) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

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
      .orderBy(asc(books.bookId));

    return NextResponse.json({
      ok: true,
      books: rows,
      currentTeacherId: session.teacherId ?? null,
      currentRole: session.role,
    });
  } catch (error) {
    console.error("[GET /api/teacher/books]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to load books.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();

    if (!session || (session.role !== "teacher" && session.role !== "admin")) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const bookId = normalizeText(body?.bookId);
    const title = normalizeText(body?.title);
    const pageCount = normalizePageCount(body?.pageCount);

    const requestedOwnerTeacherId = normalizeOwnerTeacherId(body?.ownerTeacherId);

    if (!bookId) {
      return NextResponse.json(
        { ok: false, message: "bookId is required." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, message: "title is required." },
        { status: 400 }
      );
    }

    const ownerTeacherId =
      session.role === "admin"
        ? requestedOwnerTeacherId ?? session.teacherId
        : session.teacherId;

    const ownerTeacher = await db.query.teachers.findFirst({
      where: eq(teachers.id, ownerTeacherId),
    });

    if (!ownerTeacher) {
      return NextResponse.json(
        { ok: false, message: "ownerTeacherId is invalid." },
        { status: 400 }
      );
    }

    const existing = await db.query.books.findFirst({
      where: eq(books.bookId, bookId),
    });

    if (!existing) {
      const inserted = await db
        .insert(books)
        .values({
          bookId,
          title,
          ownerTeacherId,
          pageCount,
          // mode / isPublished はDBのdefaultを使う
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: books.id,
          bookId: books.bookId,
          title: books.title,
          ownerTeacherId: books.ownerTeacherId,
          mode: books.mode,
          isPublished: books.isPublished,
          pageCount: books.pageCount,
          createdAt: books.createdAt,
          updatedAt: books.updatedAt,
        });

      return NextResponse.json({
        ok: true,
        action: "inserted",
        book: inserted[0] ?? null,
      });
    }

    const canUpdate =
      session.role === "admin" || existing.ownerTeacherId === session.teacherId;

    if (!canUpdate) {
      return NextResponse.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const updated = await db
      .update(books)
      .set({
        title,
        ownerTeacherId,
        pageCount,
        updatedAt: new Date(),
        // mode / isPublished は維持するため触らない
      })
      .where(eq(books.bookId, bookId))
      .returning({
        id: books.id,
        bookId: books.bookId,
        title: books.title,
        ownerTeacherId: books.ownerTeacherId,
        mode: books.mode,
        isPublished: books.isPublished,
        pageCount: books.pageCount,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
      });

    return NextResponse.json({
      ok: true,
      action: "updated",
      book: updated[0] ?? null,
    });
  } catch (error) {
    console.error("[POST /api/teacher/books]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to upsert book.",
      },
      { status: 500 }
    );
  }
}