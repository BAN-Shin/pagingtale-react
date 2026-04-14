import { NextResponse } from "next/server";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(
  _req: Request,
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
    const [teacher] = await db
      .select({
        id: teachers.id,
        teacherName: teachers.teacherName,
        isActive: teachers.isActive,
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

    const nextIsActive = !teacher.isActive;

    await db
      .update(teachers)
      .set({
        isActive: nextIsActive,
        updatedAt: new Date(),
      })
      .where(eq(teachers.id, id));

    return NextResponse.json({
      ok: true,
      message: nextIsActive
        ? `「${teacher.teacherName}」を有効にしました。`
        : `「${teacher.teacherName}」を無効にしました。`,
    });
  } catch (e) {
    console.error("toggle teacher active route error:", e);
    return NextResponse.json(
      { ok: false, message: "更新エラー" },
      { status: 500 }
    );
  }
}