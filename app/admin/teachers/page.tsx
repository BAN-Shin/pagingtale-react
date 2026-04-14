import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import TeacherManager from "@/components/admin/TeacherManager";

export default async function Page() {
  const session = await getAdminSession();

  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  return <TeacherManager />;
}