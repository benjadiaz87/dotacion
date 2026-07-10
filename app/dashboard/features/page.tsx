import { auth } from "@/lib/auth";
import { getFeatureRequests } from "@/lib/actions/features";
import { FeaturesView } from "@/components/features-view";

export default async function FeaturesPage() {
  const session = await auth();
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";
  const features = await getFeatureRequests();

  return (
    <div className="min-h-screen bg-muted/30">
      <FeaturesView features={features} canWrite={canWrite} />
    </div>
  );
}
