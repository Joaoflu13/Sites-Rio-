import { requireUser } from "@/lib/admin";
import Topbar from "@/components/Topbar";

// Área logada do dev: tudo abaixo de /app exige sessão.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <Topbar />
      {children}
    </>
  );
}
