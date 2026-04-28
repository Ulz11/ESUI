import { Suspense } from "react";
import { VerifyPage } from "@/components/VerifyPage";

export default function VerifyRoute() {
  return (
    <Suspense fallback={null}>
      <VerifyPage />
    </Suspense>
  );
}
