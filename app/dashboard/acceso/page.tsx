import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlatformUsers } from "@/lib/actions/users";
import { AccesoView } from "@/components/acceso-view";

export default async function AccesoPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "SUPERADMIN") redirect("/dashboard");

  const users = await getPlatformUsers();

  return (
    <div className="min-h-screen bg-muted/30">
      <AccesoView users={users} />
    </div>
  );
}
