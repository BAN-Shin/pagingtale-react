import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { books, teachers } from "@/db/schema";

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

function getApiKeyFromRequest(req: NextRequest): string {
  return normalizeText(req.headers.get("x-api-key"));
}

function getServerApiKey(): string {
  return normalizeText(process.env.BOOKS_UPSERT_API_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const requestApiKey = getApiKeyFromRequest(req);
    const serverApiKey = getServerApiKey();

    if (!serverApiKey) {
      return NextResponse.json(
        { ok: false, message: "BOOKS_UPSERT_API_KEY is not configured." },
        { status: 500 }
      );
    }

    if (!requestApiKey || requestApiKey !== serverApiKey) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const bookId = normalizeText(body?.bookId);
    const title = normalizeText(body?.title);
    const pageCount = normalizePageCount(body?.pageCount);
    const ownerTeacherId = normalizeOwnerTeacherId(body?.ownerTeacherId);

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

    if (!ownerTeacherId) {
      return NextResponse.json(
        { ok: false, message: "ownerTeacherId is required." },
        { status: 400 }
      );
    }

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
          mode: "dev",
          isPublished: false,
          pageCount,
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

    if (existing.ownerTeacherId !== ownerTeacherId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "bookId already exists and belongs to another teacher. Update was rejected.",
        },
        { status: 403 }
      );
    }

    const updated = await db
      .update(books)
      .set({
        title,
        mode: "dev",
        isPublished: false,
        pageCount,
        updatedAt: new Date(),
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
    console.error("[POST /api/books/upsert-from-excel]", error);

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