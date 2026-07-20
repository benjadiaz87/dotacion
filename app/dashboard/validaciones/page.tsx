import { getValidacionesHistorial } from "@/lib/actions/ejecutivo";
import { ValidacionesView } from "@/components/validaciones-view";

export default async function ValidacionesPage() {
  const items = await getValidacionesHistorial();
  return (
    <div className="min-h-screen bg-muted/30">
      <ValidacionesView items={items} />
    </div>
  );
}
