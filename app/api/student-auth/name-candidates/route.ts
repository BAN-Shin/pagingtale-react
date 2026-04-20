import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";

function parseClassId(value: string | null): number | null {
  const classId = Number(value ?? "");

  if (!Number.isInteger(classId) || classId <= 0) {
    return null;
  }

  return classId;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = parseClassId(searchParams.get("classId"));
    const keyword = String(searchParams.get("q") ?? "").trim();

    if (!classId) {
      return NextResponse.json({
        ok: true,
        candidates: [],
      });
    }

    if (keyword.length < 2) {
      return NextResponse.json({
        ok: true,
        candidates: [],
      });
    }

    const rows = await db
      .select({
        id: students.id,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          ilike(students.studentName, `${keyword}%`)
        )
      )
      .orderBy(asc(students.studentName), asc(students.studentNumber))
      .limit(5);

    return NextResponse.json({
      ok: true,
      candidates: rows.map((row) => ({
        id: row.id,
        studentNumber: row.studentNumber,
        studentName: row.studentName,
      })),
    });
  } catch (error) {
    console.error("name-candidates route error:", error);

    return NextResponse.json(
      {
        ok: false,
        candidates: [],
        message: "候補取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}