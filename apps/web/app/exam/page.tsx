import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/lib/auth-guard";

export default function ExamRoute() {
  return (
    <AuthGuard>
      <AppShell initialRoute="exam" />
    </AuthGuard>
  );
}
