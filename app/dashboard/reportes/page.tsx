import { getReportesData } from "@/lib/actions/reportes";
import { ReportesDashboard } from "@/components/reportes-dashboard";

export default async function ReportesPage() {
  const data = await getReportesData();

  const generadoEn = new Date().toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return <ReportesDashboard data={data} generadoEn={generadoEn} />;
}
