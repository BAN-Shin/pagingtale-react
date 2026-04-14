"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classes, testAssignments } from "@/db/schema";

function buildClassesUrl(params?: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) continue;

    const text = String(value).trim();
    if (!text) continue;

    searchParams.set(key, text);
  }

  const query = searchParams.toString();
  return query ? `/admin/classes?${query}` : "/admin/classes";
}

function normalizeClassName(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeId(value: FormDataEntryValue | null): number {
  const id = Number(String(value ?? "").trim());
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function addClass(formData: FormData) {
  const q = normalizeText(formData.get("q"));
  const className = normalizeClassName(formData.get("className"));

  if (!className) {
    redirect(buildClassesUrl({ q, toast: "add_error" }));
  }

  try {
    const [created] = await db
      .insert(classes)
      .values({
        name: className,
      })
      .returning({
        id: classes.id,
        name: classes.name,
      });

    if (!created?.id) {
      redirect(buildClassesUrl({ q, toast: "add_error" }));
    }

    redirect(
      buildClassesUrl({
        q,
        toast: "added",
        undo: "add",
        classId: created.id,
        className: created.name,
      })
    );
  } catch (error) {
    console.error("addClass error:", error);
    redirect(buildClassesUrl({ q, toast: "add_error" }));
  }
}

export async function updateClass(formData: FormData) {
  const q = normalizeText(formData.get("q"));
  const id = normalizeId(formData.get("id"));
  const className = normalizeClassName(formData.get("className"));

  if (!id || !className) {
    redirect(buildClassesUrl({ q, toast: "update_error" }));
  }

  try {
    const [current] = await db
      .select({
        id: classes.id,
        name: classes.name,
      })
      .from(classes)
      .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
      .limit(1);

    if (!current) {
      redirect(buildClassesUrl({ q, toast: "update_error" }));
    }

    await db
      .update(classes)
      .set({
        name: className,
      })
      .where(eq(classes.id, id));

    redirect(
      buildClassesUrl({
        q,
        toast: "updated",
        undo: "update",
        classId: id,
        className,
        prevClassName: current.name,
      })
    );
  } catch (error) {
    console.error("updateClass error:", error);
    redirect(buildClassesUrl({ q, toast: "update_error" }));
  }
}

export async function deleteClass(formData: FormData) {
  const q = normalizeText(formData.get("q"));
  const id = normalizeId(formData.get("id"));

  if (!id) {
    redirect(buildClassesUrl({ q, toast: "delete_error" }));
  }

  try {
    const [current] = await db
      .select({
        id: classes.id,
        name: classes.name,
      })
      .from(classes)
      .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
      .limit(1);

    if (!current) {
      redirect(buildClassesUrl({ q, toast: "delete_error" }));
    }

    const activeAssignments = await db
      .select({
        id: testAssignments.id,
      })
      .from(testAssignments)
      .where(
        and(
          eq(testAssignments.classId, id),
          eq(testAssignments.isActive, true)
        )
      )
      .limit(1);

    if (activeAssignments.length > 0) {
      redirect(buildClassesUrl({ q, toast: "delete_error" }));
    }

    await db
      .update(classes)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(classes.id, id));

    redirect(
      buildClassesUrl({
        q,
        toast: "deleted",
        undo: "delete",
        classId: id,
        className: current.name,
      })
    );
  } catch (error) {
    console.error("deleteClass error:", error);
    redirect(buildClassesUrl({ q, toast: "delete_error" }));
  }
}

export async function undoClassAction(formData: FormData) {
  const undo = normalizeText(formData.get("undo"));
  const q = normalizeText(formData.get("q"));
  const classId = normalizeId(formData.get("classId"));
  const className = normalizeClassName(formData.get("className"));
  const prevClassName = normalizeClassName(formData.get("prevClassName"));

  if (!undo || !classId) {
    redirect(buildClassesUrl({ q, toast: "undo_error" }));
  }

  try {
    if (undo === "add") {
      await db
        .update(classes)
        .set({
          deletedAt: new Date(),
        })
        .where(eq(classes.id, classId));

      redirect(buildClassesUrl({ q, toast: "restored" }));
    }

    if (undo === "update") {
      if (!prevClassName) {
        redirect(buildClassesUrl({ q, toast: "undo_error" }));
      }

      await db
        .update(classes)
        .set({
          name: prevClassName,
        })
        .where(eq(classes.id, classId));

      redirect(buildClassesUrl({ q, toast: "restored" }));
    }

    if (undo === "delete") {
      await db
        .update(classes)
        .set({
          deletedAt: null,
          name: className || undefined,
        })
        .where(eq(classes.id, classId));

      redirect(buildClassesUrl({ q, toast: "restored" }));
    }

    redirect(buildClassesUrl({ q, toast: "undo_error" }));
  } catch (error) {
    console.error("undoClassAction error:", error);
    redirect(buildClassesUrl({ q, toast: "undo_error" }));
  }
}