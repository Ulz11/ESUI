import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function VaultRoute() {
  return (
    <AuthGuard>
      <AppShell initialRoute="vault" />
    </AuthGuard>
  );
}
