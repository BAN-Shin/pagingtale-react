import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

type UpdateTeacherBody = {
  teacherName?: string;
};

export async function PATCH(
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

    const body = (await req.json()) as UpdateTeacherBody;
    const teacherName = String(body.teacherName ?? "").trim();

    if (!teacherName) {
      return NextResponse.json(
        { ok: false, message: "名前を入力してください。" },
        { status: 400 }
      );
    }

    const [currentTeacher] = await db
      .select({
        id: teachers.id,
        teacherName: teachers.teacherName,
      })
      .from(teachers)
      .where(eq(teachers.id, id))
      .limit(1);

    if (!currentTeacher) {
      return NextResponse.json(
        { ok: false, message: "教師が見つかりません。" },
        { status: 404 }
      );
    }

    const [updatedTeacher] = await db
      .update(teachers)
      .set({
        teacherName,
        updatedAt: new Date(),
      })
      .where(eq(teachers.id, id))
      .returning({
        id: teachers.id,
        loginId: teachers.loginId,
        teacherName: teachers.teacherName,
        role: teachers.role,
        isActive: teachers.isActive,
      });

    return NextResponse.json({
      ok: true,
      message: `「${updatedTeacher.teacherName}」の名前を更新しました。`,
      teacher: updatedTeacher,
    });
  } catch (error) {
    console.error("update teacher route error:", error);

    return NextResponse.json(
      { ok: false, message: "教師情報の更新中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}