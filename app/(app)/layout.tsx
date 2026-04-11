import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppNavbar from "@/components/app/app-navbar";
import Sidebar from "@/components/app/sidebar";
import Providers from "@/components/app/providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <Providers>
      <AppNavbar />
      <Sidebar />
      <main
        className="pt-16 pl-[220px] min-h-screen"
        style={{ background: "var(--bg)" }}
      >
        <div className="max-w-[1200px] mx-auto px-8 py-8">{children}</div>
      </main>
    </Providers>
  );
}
