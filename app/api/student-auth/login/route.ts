import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { setStudentSession, verifyStudentPassword } from "@/lib/student-auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{
      classId: number | string;
      studentNumber: string;
      studentName: string;
      password: string;
    }>;

    const classId = Number(body.classId ?? 0);
    const studentNumber = String(body.studentNumber ?? "").trim();
    const studentName = String(body.studentName ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!classId || !studentNumber || !studentName || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "クラス・学籍番号・氏名・パスワードを入力してください。",
        },
        { status: 400 }
      );
    }

    const [student] = await db
      .select({
        id: students.id,
        classId: students.classId,
        studentNumber: students.studentNumber,
        studentName: students.studentName,
        passwordHash: students.passwordHash,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          eq(students.studentNumber, studentNumber),
          eq(students.studentName, studentName)
        )
      )
      .limit(1);

    if (!student) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログイン情報が一致しません。",
        },
        { status: 400 }
      );
    }

    if (!verifyStudentPassword(password, student.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログイン情報が一致しません。",
        },
        { status: 400 }
      );
    }

    await setStudentSession({
      studentId: student.id,
      classId: student.classId,
      studentNumber: student.studentNumber,
      studentName: student.studentName,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("student login route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `ログイン処理エラー: ${error.message}`
            : "ログイン処理で不明なエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}