"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallbackUrl }: { fallbackUrl?: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl || "/bills");
    }
  };

  return (
    <Button
      variant="ghost"
      className="gap-2 pl-0 hover:pl-2 transition-all"
      onClick={handleBack}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
