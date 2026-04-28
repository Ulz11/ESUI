import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function ChatRoute() {
  return (
    <AuthGuard>
      <AppShell initialRoute="chat" />
    </AuthGuard>
  );
}
