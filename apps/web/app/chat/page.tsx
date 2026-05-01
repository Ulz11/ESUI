import { AuthGuard } from "@/lib/auth-guard";
import { V3App } from "@/components/v3/V3App";

export default function ChatRoute() {
  return (
    <AuthGuard>
      <V3App initialRoute="chat" />
    </AuthGuard>
  );
}
