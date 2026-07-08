import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCargosData } from "@/lib/actions/roles";
import { CargosView } from "@/components/cargos-view";

export default async function CargosPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "SUPERADMIN") redirect("/dashboard");

  const data = await getCargosData();

  return (
    <div className="min-h-screen bg-muted/30">
      <CargosView data={data} />
    </div>
  );
}
