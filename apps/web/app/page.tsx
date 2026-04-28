import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function HomePage() {
  return (
    <AuthGuard>
      <AppShell initialRoute="home" />
    </AuthGuard>
  );
}
