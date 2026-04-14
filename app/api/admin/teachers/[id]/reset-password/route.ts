import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { getAdminSession, makeTeacherPasswordHash } from "@/lib/admin-auth";

type ResetPasswordBody = {
  newPassword?: string;
};

function isStrongEnoughPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  return hasLetter && hasDigit;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await getAdminSession();

    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json(
        { ok: false, message: "権限がありません。" },
        { status: 403 }
      );
    }

    const { id: idText } = await params;
    const id = Number(idText);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, message: "教師IDが不正です。" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as ResetPasswordBody;
    const newPassword = String(body.newPassword ?? "").trim();

    if (!newPassword) {
      return NextResponse.json(
        { ok: false, message: "新しいパスワードを入力してください。" },
        { status: 400 }
      );
    }

    if (!isStrongEnoughPassword(newPassword)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "パスワードは8文字以上で、英字と数字を両方含めてください。",
        },
        { status: 400 }
      );
    }

    const [teacher] = await db
      .select({
        id: teachers.id,
        teacherName: teachers.teacherName,
      })
      .from(teachers)
      .where(eq(teachers.id, id))
      .limit(1);

    if (!teacher) {
      return NextResponse.json(
        { ok: false, message: "教師が見つかりません。" },
        { status: 404 }
      );
    }

    const passwordHash = makeTeacherPasswordHash(newPassword);

    await db
      .update(teachers)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(teachers.id, id));

    return NextResponse.json({
      ok: true,
      message: `「${teacher.teacherName}」のパスワードをリセットしました。`,
    });
  } catch (error) {
    console.error("reset teacher password route error:", error);

    return NextResponse.json(
      { ok: false, message: "パスワードリセット中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}