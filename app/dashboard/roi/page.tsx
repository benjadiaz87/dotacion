import { getRoiBaseline } from "@/lib/actions/ejecutivo";
import { RoiView } from "@/components/roi-view";

export default async function RoiPage() {
  const baseline = await getRoiBaseline();
  return (
    <div className="min-h-screen bg-muted/30">
      <RoiView baseline={baseline} />
    </div>
  );
}
