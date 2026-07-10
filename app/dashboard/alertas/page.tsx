import { auth } from "@/lib/auth";
import { getAlertas } from "@/lib/actions/alertas";
import { AlertasView } from "@/components/alertas-view";

export default async function AlertasPage() {
  const session = await auth();
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";
  const data = await getAlertas();

  return (
    <div className="min-h-screen bg-muted/30">
      <AlertasView data={data} canWrite={canWrite} />
    </div>
  );
}
