import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Badge del sidebar: documentos vencidos (proxy liviano de alertas críticas)
  const docsVencidos = await db.workerDocument.count({
    where: { status: "APPROVED", expiresAt: { not: null, lt: new Date() } },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        alertasCriticas={docsVencidos}
        user={{
          name: session.user.name,
          email: session.user.email,
          role: (session.user as { role?: string }).role ?? null,
        }}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
