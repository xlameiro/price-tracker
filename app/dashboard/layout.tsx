import { auth } from "@/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect(ROUTES.signIn);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        id="maincontent"
        tabIndex={-1}
        className="flex-1 overflow-auto p-6 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}
