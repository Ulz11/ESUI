import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function SignalsRoute() {
  return (
    <AuthGuard>
      <AppShell initialRoute="signals" />
    </AuthGuard>
  );
}
