import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getRoleDetail } from "@/lib/actions/roles";
import { CargoPipeline } from "@/components/cargo-pipeline";

export default async function CargoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  if (userRole !== "SUPERADMIN") redirect("/dashboard");

  const { id } = await params;
  const detail = await getRoleDetail(id);
  if (!detail) notFound();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CargoPipeline detail={detail} />
      </div>
    </div>
  );
}
