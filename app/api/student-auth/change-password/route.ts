import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import {
  getStudentSession,
  makeStudentPasswordHash,
  verifyStudentPassword,
} from "@/lib/student-auth";

type RequestBody = {
  currentPassword?: string;
  nextPassword?: string;
  confirmPassword?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as RequestBody;

    const currentPassword = String(body.currentPassword ?? "").trim();
    const nextPassword = String(body.nextPassword ?? "").trim();
    const confirmPassword = String(body.confirmPassword ?? "").trim();

    if (!currentPassword || !nextPassword || !confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のパスワード・新しいパスワード・確認用パスワードを入力してください。",
        },
        { status: 400 }
      );
    }

    if (nextPassword.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          message: "新しいパスワードは4文字以上で入力してください。",
        },
        { status: 400 }
      );
    }

    if (nextPassword !== confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "新しいパスワードと確認用パスワードが一致しません。",
        },
        { status: 400 }
      );
    }

    if (currentPassword === nextPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のパスワードと異なる新しいパスワードを入力してください。",
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
          eq(students.id, session.studentId),
          eq(students.classId, session.classId),
          eq(students.studentNumber, session.studentNumber),
          eq(students.studentName, session.studentName)
        )
      )
      .limit(1);

    if (!student) {
      return NextResponse.json(
        {
          ok: false,
          message: "対象の生徒情報が見つかりません。",
        },
        { status: 404 }
      );
    }

    if (!verifyStudentPassword(currentPassword, student.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message: "現在のパスワードが正しくありません。",
        },
        { status: 400 }
      );
    }

    const nextPasswordHash = makeStudentPasswordHash(nextPassword);

    await db
      .update(students)
      .set({
        passwordHash: nextPasswordHash,
      })
      .where(eq(students.id, student.id));

    return NextResponse.json({
      ok: true,
      message: "パスワードを変更しました。",
    });
  } catch (error) {
    console.error("student change-password route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "パスワード変更中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}