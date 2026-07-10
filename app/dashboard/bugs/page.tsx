import { auth } from "@/lib/auth";
import { getFeatureRequests } from "@/lib/actions/features";
import { FeaturesView } from "@/components/features-view";

export default async function BugsPage() {
  const session = await auth();
  const canWrite = (session?.user as { role?: string } | undefined)?.role !== "AUDITOR";
  const bugs = (await getFeatureRequests()).filter((f) => f.tipo === "BUG");

  return (
    <div className="min-h-screen bg-muted/30">
      <FeaturesView features={bugs} canWrite={canWrite} mode="bugs" />
    </div>
  );
}
