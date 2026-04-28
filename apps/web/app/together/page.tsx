import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function TogetherRoute() {
  return (
    <AuthGuard>
      <AppShell initialRoute="together" />
    </AuthGuard>
  );
}
