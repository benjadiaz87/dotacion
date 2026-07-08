import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{
        name: session.user.name,
        email: session.user.email,
        role: (session.user as { role?: string }).role ?? null,
      }} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
